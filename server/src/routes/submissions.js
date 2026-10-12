import crypto from "node:crypto";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { db } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError, asyncHandler } from "../lib/errors.js";
import { calculateRemainingClaim } from "../services/claims.js";
import { verifySubmission } from "../services/submission-verification.js";
import { runOracle } from "../services/oracle-worker.js";
import {
  buildAcceptSubmissionIntent,
  buildClaimIntent,
  buildRegisterSubmissionIntent,
  buildRejectSubmissionIntent,
  deriveVaultAddress,
} from "../services/transaction-intents.js";

const router = Router();
const claimIpLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const claimWalletLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  keyGenerator: (req) => req.auth.wallet,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.post(
  "/campaigns/:id/submissions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { videoId } = z.object({ videoId: z.string() }).parse(req.body);
    const campaign = await db("campaigns").where({ id: req.params.id }).first();
    if (!campaign)
      throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");
    const video = await verifySubmission({
      campaign,
      wallet: req.auth.wallet,
      videoId,
    });
    const intentId = crypto.randomUUID();
    await db("submission_intents")
      .insert({
        id: intentId,
        campaign_id: campaign.id,
        clipper_wallet: req.auth.wallet,
        youtube_video_id: videoId,
        channel_id: video.channelId,
        title: video.title,
        published_at: video.publishedAt,
        terms_hash: campaign.terms_hash,
        expires_at: new Date(Date.now() + 30 * 60_000),
      })
      .onConflict(["campaign_id", "youtube_video_id"])
      .merge({
        id: intentId,
        clipper_wallet: req.auth.wallet,
        channel_id: video.channelId,
        title: video.title,
        published_at: video.publishedAt,
        terms_hash: campaign.terms_hash,
        expires_at: new Date(Date.now() + 30 * 60_000),
      });
    const transaction = await buildRegisterSubmissionIntent({
      campaign: campaign.onchain_campaign,
      clipper: req.auth.wallet,
      videoId,
      termsHash: campaign.terms_hash,
    });
    res.json({ intentId, verifiedVideo: video, transaction });
  })
);

router.get(
  "/campaigns/:id/submissions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const campaign = await db("campaigns").where({ id: req.params.id }).first();
    if (!campaign)
      throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");
    if (campaign.creator_wallet !== req.auth.wallet)
      throw new AppError(
        403,
        "FORBIDDEN",
        "Only the campaign creator can list all submissions"
      );
    res.json({
      submissions: await db("submissions")
        .where({ campaign_id: campaign.id })
        .orderBy("created_at", "desc"),
    });
  })
);

router.get(
  "/submissions/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const submission = await db("submissions as s")
      .join("campaigns as c", "c.id", "s.campaign_id")
      .select("s.*", "c.creator_wallet")
      .where("s.id", req.params.id)
      .first();
    if (!submission)
      throw new AppError(404, "SUBMISSION_NOT_FOUND", "Submission not found");
    if (
      ![submission.clipper_wallet, submission.creator_wallet].includes(
        req.auth.wallet
      )
    )
      throw new AppError(403, "FORBIDDEN", "You cannot access this submission");
    res.json({ submission });
  })
);

router.post(
  "/submissions/:id/review-note",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        action: z.enum(["REJECT", "APPEAL"]),
        reason: z.string().trim().min(1).max(5000),
        txSignature: z.string().optional(),
      })
      .parse(req.body);
    const submission = await db("submissions as s")
      .join("campaigns as c", "c.id", "s.campaign_id")
      .select("s.*", "c.creator_wallet")
      .where("s.id", req.params.id)
      .first();
    if (!submission)
      throw new AppError(404, "SUBMISSION_NOT_FOUND", "Submission not found");
    const actorAllowed =
      input.action === "REJECT"
        ? submission.creator_wallet === req.auth.wallet
        : submission.clipper_wallet === req.auth.wallet;
    if (!actorAllowed)
      throw new AppError(
        403,
        "FORBIDDEN",
        "Wallet is not allowed to add this note"
      );
    const reasonHash = crypto
      .createHash("sha256")
      .update(input.reason)
      .digest("hex");
    const [note] = await db("review_actions")
      .insert({
        submission_id: submission.id,
        actor_wallet: req.auth.wallet,
        action: input.action,
        reason: input.reason,
        reason_hash: reasonHash,
        tx_signature: input.txSignature,
      })
      .returning("*");
    res.status(201).json({ note });
  })
);

router.post(
  "/submissions/:id/accept-intent",
  requireAuth,
  asyncHandler(async (req, res) => {
    const submission = await db("submissions as s")
      .join("campaigns as c", "c.id", "s.campaign_id")
      .select("s.*", "c.creator_wallet", "c.onchain_campaign")
      .where("s.id", req.params.id)
      .first();
    if (!submission)
      throw new AppError(404, "SUBMISSION_NOT_FOUND", "Submission not found");
    if (submission.creator_wallet !== req.auth.wallet)
      throw new AppError(403, "FORBIDDEN", "Only campaign creator can accept submissions");
    if (submission.status !== "PENDING_REVIEW")
      throw new AppError(400, "INVALID_STATE", `Submission is already ${submission.status}`);

    const transaction = await buildAcceptSubmissionIntent({
      campaign: submission.onchain_campaign,
      submission: submission.onchain_submission,
      clipper: submission.clipper_wallet,
      creator: req.auth.wallet,
    });

    res.json({
      submissionId: submission.id,
      transaction,
    });
  })
);

router.post(
  "/submissions/:id/reject-intent",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        reason: z.string().trim().min(1).max(5000),
      })
      .parse(req.body);

    const submission = await db("submissions as s")
      .join("campaigns as c", "c.id", "s.campaign_id")
      .select("s.*", "c.creator_wallet", "c.onchain_campaign")
      .where("s.id", req.params.id)
      .first();
    if (!submission)
      throw new AppError(404, "SUBMISSION_NOT_FOUND", "Submission not found");
    if (submission.creator_wallet !== req.auth.wallet)
      throw new AppError(403, "FORBIDDEN", "Only campaign creator can reject submissions");
    if (submission.status !== "PENDING_REVIEW")
      throw new AppError(400, "INVALID_STATE", `Submission is already ${submission.status}`);

    const reasonHash = crypto
      .createHash("sha256")
      .update(input.reason)
      .digest("hex");

    const transaction = await buildRejectSubmissionIntent({
      campaign: submission.onchain_campaign,
      submission: submission.onchain_submission,
      clipper: submission.clipper_wallet,
      creator: req.auth.wallet,
      reasonHash,
    });

    res.json({
      submissionId: submission.id,
      reasonHash,
      transaction,
    });
  })
);


router.post(
  "/submissions/:id/claim-request",
  claimIpLimiter,
  requireAuth,
  claimWalletLimiter,
  asyncHandler(async (req, res) => {
    const submission = await db("submissions as s")
      .join("campaigns as c", "c.id", "s.campaign_id")
      .select(
        "s.*",
        "c.cpm",
        "c.max_payout_per_video",
        "c.max_report_age",
        "c.end_time",
        "c.settlement_period",
        "c.final_snapshot_tolerance",
        "c.onchain_campaign",
        "c.payment_mint"
      )
      .where("s.id", req.params.id)
      .first();
    if (!submission)
      throw new AppError(404, "SUBMISSION_NOT_FOUND", "Submission not found");
    if (submission.clipper_wallet !== req.auth.wallet)
      throw new AppError(
        403,
        "FORBIDDEN",
        "Only the submission owner can request a claim"
      );
    if (submission.status !== "ACCEPTED")
      throw new AppError(
        409,
        "SUBMISSION_NOT_ACCEPTED",
        "Submission must be accepted before claiming"
      );
    if (submission.baseline_views == null)
      throw new AppError(
        409,
        "BASELINE_MISSING",
        "Baseline report has not been confirmed"
      );
    if (
      Math.floor(Date.now() / 1000) >
      Number(submission.end_time) + Number(submission.settlement_period)
    )
      throw new AppError(409, "SETTLEMENT_OVER", "Settlement period is over");

    const lastRequest = await db("claim_requests")
      .where({ submission_id: submission.id })
      .orderBy("created_at", "desc")
      .first();
    if (
      lastRequest &&
      Date.now() - new Date(lastRequest.created_at).getTime() <
        Number(process.env.CLAIM_REQUEST_COOLDOWN_SECONDS || 60) * 1000
    )
      throw new AppError(
        429,
        "CLAIM_COOLDOWN",
        "Wait before requesting another claim"
      );
    const report = await db("oracle_reports")
      .where({ submission_id: submission.id, status: "confirmed" })
      .orderBy("fetched_at", "desc")
      .first();
    if (!report)
      throw new AppError(
        409,
        "REPORT_MISSING",
        "No confirmed oracle report is available"
      );
    const amount = calculateRemainingClaim({
      viewCount: report.view_count,
      baselineViews: submission.baseline_views,
      cpm: submission.cpm,
      maxPayoutPerVideo: submission.max_payout_per_video,
      totalPaid: submission.total_paid,
    });
    if (amount.remaining === "0")
      throw new AppError(
        409,
        "NOTHING_TO_CLAIM",
        "No claimable balance remains"
      );

    const nowSeconds = Math.floor(Date.now() / 1000);
    const isCurrentReporter =
      Boolean(process.env.ORACLE_REPORTER) &&
      report.reporter === process.env.ORACLE_REPORTER;
    const isFresh =
      Date.now() - new Date(report.fetched_at).getTime() <=
      Number(submission.max_report_age) * 1000;
    const isAfterEndUsable =
      nowSeconds > Number(submission.end_time) &&
      (report.is_final ||
        nowSeconds >
          Number(submission.end_time) +
            Number(submission.final_snapshot_tolerance));
    const status =
      isCurrentReporter &&
      (nowSeconds <= Number(submission.end_time) ? isFresh : isAfterEndUsable)
        ? "READY"
        : "PENDING";
    const [request] = await db("claim_requests")
      .insert({
        submission_id: submission.id,
        clipper_wallet: req.auth.wallet,
        status,
      })
      .returning("*");
    let currentRequest = request;
    if (status === "PENDING") {
      await runOracle({ submissionId: submission.id, reason: "claim" });
      currentRequest = await db("claim_requests")
        .where({ id: request.id })
        .first();
    }
    let transaction = null;
    if (currentRequest.status === "READY") {
      const vault = await deriveVaultAddress(submission.onchain_campaign);
      transaction = await buildClaimIntent({
        campaign: submission.onchain_campaign,
        submission: submission.onchain_submission,
        vault,
        mint: submission.payment_mint,
        clipper: req.auth.wallet,
      });
    }
    res.status(currentRequest.status === "READY" ? 200 : 202).json({
      claimRequest: currentRequest,
      amount,
      transaction,
    });
  })
);

router.get(
  "/claim-requests/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const request = await db("claim_requests as cr")
      .join("submissions as s", "s.id", "cr.submission_id")
      .join("campaigns as c", "c.id", "s.campaign_id")
      .select(
        "cr.*",
        "s.onchain_submission",
        "c.onchain_campaign",
        "c.payment_mint"
      )
      .where({ "cr.id": req.params.id, "cr.clipper_wallet": req.auth.wallet })
      .first();
    if (!request)
      throw new AppError(
        404,
        "CLAIM_REQUEST_NOT_FOUND",
        "Claim request not found"
      );
    let transaction = null;
    if (request.status === "READY") {
      const vault = await deriveVaultAddress(request.onchain_campaign);
      transaction = await buildClaimIntent({
        campaign: request.onchain_campaign,
        submission: request.onchain_submission,
        vault,
        mint: request.payment_mint,
        clipper: req.auth.wallet,
      });
    }
    res.json({ claimRequest: request, transaction });
  })
);

router.get(
  "/submissions/:id/claims",
  requireAuth,
  asyncHandler(async (req, res) => {
    const submission = await db("submissions")
      .where({ id: req.params.id, clipper_wallet: req.auth.wallet })
      .first();
    if (!submission)
      throw new AppError(404, "SUBMISSION_NOT_FOUND", "Submission not found");
    res.json({
      claims: await db("claims")
        .where({ submission_id: submission.id })
        .orderBy("created_at", "desc"),
    });
  })
);

export { router as submissionsRouter };
