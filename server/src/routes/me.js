import { Router } from "express";
import { db } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError, asyncHandler } from "../lib/errors.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/campaigns",
  asyncHandler(async (req, res) => {
    const campaignIntents = await db("campaign_intents")
      .select(
        "campaign_id",
        "campaign_data",
        "status",
        "tx_signature",
        "expires_at",
        "created_at"
      )
      .where({ creator_wallet: req.auth.wallet })
      .whereNot({ status: "FINALIZED" })
      .whereNot({ status: "EXPIRED" })
      .orderBy("created_at", "desc");
    res.json({
      campaigns: await db("campaigns")
        .where({ creator_wallet: req.auth.wallet })
        .orderBy("created_at", "desc"),
      campaignIntents: campaignIntents.map((intent) => ({
        campaignId: String(intent.campaign_id),
        title: intent.campaign_data.title,
        budget: String(intent.campaign_data.budget),
        status: intent.status,
        txSignature: intent.tx_signature,
        expiresAt: intent.expires_at,
        createdAt: intent.created_at,
      })),
    });
  })
);

router.get(
  "/submissions",
  asyncHandler(async (req, res) => {
    if (req.query.role === "creator") {
      const creatorCampaigns = await db("campaigns")
        .select("id")
        .where({ creator_wallet: req.auth.wallet });
      const campaignIds = creatorCampaigns.map((c) => c.id);
      if (!campaignIds.length) return res.json({ submissions: [] });
      const submissions = await db("submissions as s")
        .join("campaigns as c", "c.id", "s.campaign_id")
        .select(
          "s.*",
          "c.title as campaign_title",
          "c.creator_wallet",
          "c.cpm",
          "c.max_payout_per_video",
          "c.end_time as campaign_end_time"
        )
        .whereIn("s.campaign_id", campaignIds)
        .orderBy("s.created_at", "desc");
      return res.json({ submissions });
    }
    res.json({
      submissions: await db("submissions as s")
        .join("campaigns as c", "c.id", "s.campaign_id")
        .select(
          "s.*",
          "c.title as campaign_title",
          "c.creator_wallet",
          "c.cpm",
          "c.max_payout_per_video",
          "c.end_time as campaign_end_time"
        )
        .where("s.clipper_wallet", req.auth.wallet)
        .orderBy("s.created_at", "desc"),
    });
  })
);

router.get(
  "/claims",
  asyncHandler(async (req, res) => {
    res.json({
      claims: await db("claims as cl")
        .join("submissions as s", "s.id", "cl.submission_id")
        .join("campaigns as c", "c.id", "s.campaign_id")
        .select(
          "cl.*",
          "s.title as submission_title",
          "c.title as campaign_title"
        )
        .where("s.clipper_wallet", req.auth.wallet)
        .orderBy("cl.created_at", "desc"),
    });
  })
);

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const workspace = req.query.workspace === "creator" ? "creator" : "clipper";
    if (workspace === "creator") {
      const campaigns = await db("campaigns")
        .where({ creator_wallet: req.auth.wallet })
        .select("id", "status", "total_funded", "total_paid");
      const campaignIds = campaigns.map((campaign) => campaign.id);
      const pendingReviews = campaignIds.length
        ? await db("submissions")
            .whereIn("campaign_id", campaignIds)
            .where({ status: "PENDING_REVIEW" })
            .count({ count: "*" })
            .first()
        : { count: 0 };
      res.json({
        workspace,
        summary: {
          campaigns: campaigns.length,
          activeCampaigns: campaigns.filter((item) => item.status === "FUNDED")
            .length,
          pendingReviews: Number(pendingReviews?.count || 0),
          totalFunded: campaigns
            .reduce((total, item) => total + BigInt(item.total_funded || 0), 0n)
            .toString(),
          totalPaid: campaigns
            .reduce((total, item) => total + BigInt(item.total_paid || 0), 0n)
            .toString(),
        },
      });
      return;
    }

    const submissions = await db("submissions")
      .where({ clipper_wallet: req.auth.wallet })
      .select("id", "status", "total_paid");
    const claims = await db("claims as cl")
      .join("submissions as s", "s.id", "cl.submission_id")
      .where("s.clipper_wallet", req.auth.wallet)
      .sum({ total: "cl.amount" })
      .first();
    res.json({
      workspace,
      summary: {
        submissions: submissions.length,
        pendingReview: submissions.filter(
          (item) => item.status === "PENDING_REVIEW"
        ).length,
        accepted: submissions.filter((item) => item.status === "ACCEPTED")
          .length,
        rejected: submissions.filter((item) =>
          ["REJECTED", "REJECTED_FINAL"].includes(item.status)
        ).length,
        totalEarned: String(claims?.total || 0),
      },
    });
  })
);

router.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    res.json({
      notifications: await db("notifications")
        .where({ wallet: req.auth.wallet })
        .orderBy("created_at", "desc")
        .limit(100),
    });
  })
);

router.post(
  "/notifications/:id/read",
  asyncHandler(async (req, res) => {
    const updated = await db("notifications")
      .where({ id: req.params.id, wallet: req.auth.wallet })
      .update({ read_at: new Date() });
    if (!updated)
      throw new AppError(
        404,
        "NOTIFICATION_NOT_FOUND",
        "Notification not found"
      );
    res.status(204).end();
  })
);

export { router as meRouter };
