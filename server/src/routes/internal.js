import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { requireInternalSecret } from "../middleware/internal.js";
import { AppError, asyncHandler } from "../lib/errors.js";
import {
  dispatchOracleReportById,
  runOracle,
} from "../services/oracle-worker.js";
import { processIndexerEvent } from "../services/indexer.js";
import { retryIndexerDeadLetter } from "../services/chain-indexer.js";
import { runMaintenanceCycle } from "../services/maintenance-worker.js";
import { youtubeService } from "../services/youtube/index.js";

const router = Router();
router.use(requireInternalSecret);

router.post(
  "/oracle/run",
  asyncHandler(async (req, res) => {
    const { submissionId } = z
      .object({ submissionId: z.coerce.number().int().positive().optional() })
      .parse(req.body ?? {});
    res.json({ reports: await runOracle({ submissionId }) });
  })
);

router.post(
  "/oracle/holds/:id/release",
  asyncHandler(async (req, res) => {
    const [report] = await db("oracle_reports")
      .where({ id: req.params.id, status: "held" })
      .update({ status: "pending", hold_reason: null })
      .returning("*");
    if (!report)
      throw new AppError(404, "HOLD_NOT_FOUND", "Held report not found");
    res.json({ report: await dispatchOracleReportById(report.id) });
  })
);

router.post(
  "/oracle/holds/:id/discard",
  asyncHandler(async (req, res) => {
    const [report] = await db("oracle_reports")
      .where({ id: req.params.id, status: "held" })
      .update({ status: "discarded" })
      .returning("*");
    if (!report)
      throw new AppError(404, "HOLD_NOT_FOUND", "Held report not found");
    res.json({ report });
  })
);

router.post(
  "/indexer/events",
  asyncHandler(async (req, res) => {
    const event = z
      .object({
        txSignature: z.string().min(32),
        eventIndex: z.coerce.number().int().nonnegative(),
        eventName: z.enum([
          "CampaignInitialized",
          "CampaignFunded",
          "CampaignToppedUp",
          "SubmissionRegistered",
          "SubmissionAccepted",
          "SubmissionRejected",
          "SubmissionAppealed",
          "SubmissionFinalized",
          "OracleReportSubmitted",
          "Claimed",
          "Refunded",
          "CampaignClosed",
          "OracleUpdated",
          "AdminProposed",
          "AdminTransferred",
        ]),
        payload: z.record(z.unknown()),
      })
      .parse(req.body);
    const result = await processIndexerEvent(event);
    let baseline = null;
    if (
      !result.duplicate &&
      result.submissionId &&
      event.eventName === "SubmissionRegistered"
    ) {
      try {
        baseline = await runOracle({
          submissionId: result.submissionId,
          reason: "baseline",
        });
      } catch (error) {
        req.log?.warn(
          { err: error, submissionId: result.submissionId },
          "Baseline collection deferred"
        );
        baseline = { status: "deferred" };
      }
    }
    res
      .status(result.duplicate ? 200 : 201)
      .json({ ...result, ...(baseline ? { baseline } : {}) });
  })
);

router.get(
  "/indexer/dead-letters",
  asyncHandler(async (req, res) => {
    const { includeResolved, limit } = z
      .object({
        includeResolved: z.enum(["true", "false"]).default("false"),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      })
      .parse(req.query);
    const query = db("indexer_dead_letters")
      .orderBy("last_seen_at", "desc")
      .limit(limit);
    if (includeResolved !== "true") query.whereNull("resolved_at");
    res.json({ deadLetters: await query });
  })
);

router.post(
  "/indexer/dead-letters/:signature/:eventIndex/retry",
  asyncHandler(async (req, res) => {
    const params = z
      .object({
        signature: z.string().min(32),
        eventIndex: z.coerce.number().int().nonnegative(),
      })
      .parse(req.params);
    const result = await retryIndexerDeadLetter(
      params.signature,
      params.eventIndex
    );
    res.json({ retried: true, result });
  })
);

router.post(
  "/maintenance/run",
  asyncHandler(async (_req, res) => {
    res.json(await runMaintenanceCycle());
  })
);

router.post(
  "/mock/videos/:id/views",
  asyncHandler(async (req, res) => {
    if (process.env.YOUTUBE_ADAPTER !== "mock")
      throw new AppError(404, "NOT_FOUND", "Mock adapter is disabled");
    const { views } = z
      .object({ views: z.coerce.number().int().nonnegative() })
      .parse(req.body);
    youtubeService.setViews(req.params.id, views);
    res.json({ videoId: req.params.id, views });
  })
);

export { router as internalRouter };
