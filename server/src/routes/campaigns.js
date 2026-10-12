import crypto from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { db } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError, asyncHandler } from "../lib/errors.js";
import { getTermsUrl, uploadTerms } from "../services/terms-storage.js";
import { buildCreateCampaignIntent, buildRefundIntent } from "../services/transaction-intents.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});
const unsigned = z.coerce.bigint().positive().transform(String);
const seconds = z.coerce.number().int().positive();
const optionalNonnegative = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce.number().int().nonnegative().optional()
);
const campaignSchema = z.object({
  title: z.string().trim().min(1).max(160),
  brief: z.string().trim().min(1).max(10000),
  sourceVideo: z.string().url(),
  requiredMention: z.string().trim().min(1).max(200),
  paymentMint: z.string().min(32).max(44),
  cpmBaseUnits: unsigned,
  maxPayoutPerVideo: unsigned,
  budget: unsigned,
  startTime: z.coerce.number().int(),
  endTime: z.coerce.number().int(),
  reviewPeriod: seconds,
  appealWindow: seconds,
  appealTimeout: seconds,
  settlementPeriod: seconds,
  maxReportAge: seconds,
  finalSnapshotTolerance: seconds,
  clockSkewTolerance: seconds,
  maxVideosPerClipper: z.coerce.number().int().min(1).max(100).default(5),
  minSubscribers: optionalNonnegative,
  minChannelAgeDays: optionalNonnegative,
});

router.post(
  "/",
  requireAuth,
  upload.single("terms"),
  asyncHandler(async (req, res) => {
    if (!req.file || req.file.mimetype !== "application/pdf")
      throw new AppError(
        400,
        "TERMS_PDF_REQUIRED",
        "A PDF terms file is required"
      );
    const input = campaignSchema.parse(req.body);
    const configuredMint = process.env.AUSDC_MINT_ADDRESS;
    if (!configuredMint)
      throw new AppError(
        500,
        "PAYMENT_MINT_NOT_CONFIGURED",
        "AUSDC_MINT_ADDRESS must be configured"
      );
    if (input.paymentMint !== configuredMint)
      throw new AppError(
        400,
        "UNSUPPORTED_PAYMENT_MINT",
        "paymentMint must match the configured aUSDC mint"
      );
    const now = Math.floor(Date.now() / 1000);
    if (input.startTime >= input.endTime || now >= input.endTime)
      throw new AppError(
        400,
        "INVALID_TIME_RANGE",
        "Campaign end time must be in the future and after start time"
      );
    if (input.settlementPeriod <= 2 * input.finalSnapshotTolerance)
      throw new AppError(
        400,
        "INVALID_PARAMS",
        "settlementPeriod must exceed twice finalSnapshotTolerance"
      );
    if (input.clockSkewTolerance >= input.finalSnapshotTolerance)
      throw new AppError(
        400,
        "INVALID_PARAMS",
        "clockSkewTolerance must be less than finalSnapshotTolerance"
      );
    const sequenceResult = await db.raw(
      "SELECT nextval('campaign_id_seq')::text AS id"
    );
    const campaignId = sequenceResult.rows[0].id;

    const termsHash = crypto
      .createHash("sha256")
      .update(req.file.buffer)
      .digest("hex");
    const termsFilePath = await uploadTerms(campaignId, req.file.buffer);
    const { campaign: onchainCampaign, transaction } =
      await buildCreateCampaignIntent(
        { campaignId, termsHash, ...input, cpm: input.cpmBaseUnits },
        req.auth.wallet
      );
    const row = {
      id: campaignId,
      creator_wallet: req.auth.wallet,
      title: input.title,
      brief: input.brief,
      source_video: input.sourceVideo,
      required_mention: input.requiredMention,
      payment_mint: input.paymentMint,
      terms_file_path: termsFilePath,
      terms_hash: termsHash,
      cpm: input.cpmBaseUnits,
      max_payout_per_video: input.maxPayoutPerVideo,
      budget: input.budget,
      start_time: input.startTime,
      end_time: input.endTime,
      review_period: input.reviewPeriod,
      appeal_window: input.appealWindow,
      appeal_timeout: input.appealTimeout,
      settlement_period: input.settlementPeriod,
      max_report_age: input.maxReportAge,
      final_snapshot_tolerance: input.finalSnapshotTolerance,
      clock_skew_tolerance: input.clockSkewTolerance,
      max_videos_per_clipper: input.maxVideosPerClipper,
      min_subscribers: input.minSubscribers,
      min_channel_age_days: input.minChannelAgeDays,
      onchain_campaign: onchainCampaign,
    };
    await db("campaigns").insert(row);
    res.status(201).json({
      campaign: row,
      transaction,
    });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = db("campaigns")
      .orderBy("created_at", "desc")
      .limit(Math.min(Number(req.query.limit) || 20, 100));
    if (req.query.status) query.where({ status: req.query.status });
    res.json({ campaigns: await query });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const campaign = await db("campaigns").where({ id: req.params.id }).first();
    if (!campaign)
      throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");
    res.json({ campaign });
  })
);

router.get(
  "/:id/terms",
  requireAuth,
  asyncHandler(async (req, res) => {
    const campaign = await db("campaigns")
      .select("terms_file_path", "terms_hash")
      .where({ id: req.params.id })
      .first();
    if (!campaign)
      throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");
    res.json({
      url: await getTermsUrl(campaign.terms_file_path),
      expiresIn: 300,
      termsHash: campaign.terms_hash,
    });
  })
);


router.post(
  "/:id/refund-intent",
  requireAuth,
  asyncHandler(async (req, res) => {
    const campaign = await db("campaigns").where({ id: req.params.id }).first();
    if (!campaign)
      throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");
    if (campaign.creator_wallet !== req.auth.wallet)
      throw new AppError(403, "FORBIDDEN", "Only the campaign creator can request a refund");
    if (campaign.status === "CLOSED")
      throw new AppError(409, "CAMPAIGN_ALREADY_CLOSED", "Campaign is already closed and refunded");
    if (campaign.status !== "FUNDED")
      throw new AppError(400, "INVALID_STATE", "Campaign must be funded before it can be refunded");

    const nowSeconds = Math.floor(Date.now() / 1000);
    const eligibleAt = Number(campaign.end_time) + Number(campaign.settlement_period);
    if (nowSeconds <= eligibleAt) {
      throw new AppError(
        400,
        "CAMPAIGN_STILL_ACTIVE",
        `Refund cannot be claimed until campaign and settlement period have ended (eligible at ${new Date(eligibleAt * 1000).toISOString()})`
      );
    }

    const transaction = await buildRefundIntent({
      campaign: campaign.onchain_campaign,
      creator: req.auth.wallet,
      mint: campaign.payment_mint,
    });

    res.json({
      campaignId: campaign.id,
      eligibleAt,
      transaction,
    });
  })
);

export { router as campaignsRouter };
