import { db } from "../db/index.js";
import { youtubeService } from "./youtube/index.js";
import {
  getOracleReporter,
  getSafeOracleTimestamp,
  oracleSubmitEnabled,
  submitOracleReportOnchain,
} from "./solana-oracle.js";
import { createNotification } from "./notifications.js";

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function detectAnomaly({
  snapshots,
  nextViewCount,
  maxGrowthPerHour,
  multiplier,
}) {
  if (!snapshots.length || process.env.ANOMALY_CHECK_ENABLED === "false")
    return null;
  const latest = snapshots[0];
  const hours = Math.max(
    (Date.now() - new Date(latest.fetched_at).getTime()) / 3_600_000,
    1 / 60
  );
  const currentRate =
    Math.max(0, nextViewCount - Number(latest.view_count)) / hours;
  if (currentRate > maxGrowthPerHour)
    return `growth rate ${Math.round(currentRate)}/hour exceeds absolute limit`;
  if (snapshots.length < 6) return null;
  const rates = [];
  for (let index = 0; index < snapshots.length - 1; index += 1) {
    const newer = snapshots[index];
    const older = snapshots[index + 1];
    const elapsed =
      (new Date(newer.fetched_at) - new Date(older.fetched_at)) / 3_600_000;
    if (elapsed > 0)
      rates.push(
        Math.max(0, Number(newer.view_count) - Number(older.view_count)) /
          elapsed
      );
  }
  const historicalMedian = median(rates);
  return historicalMedian > 0 && currentRate > multiplier * historicalMedian
    ? `growth rate exceeds ${multiplier}x historical median`
    : null;
}

async function dispatch(report, submission) {
  if (!oracleSubmitEnabled()) return report;
  const txSignature = await submitOracleReportOnchain({
    campaign: submission.onchain_campaign,
    submission: submission.onchain_submission,
    viewCount: report.view_count,
    fetchedAt: Math.floor(new Date(report.fetched_at).getTime() / 1000),
    isFinal: report.is_final,
  });
  const [confirmed] = await db("oracle_reports")
    .where({ id: report.id })
    .update({
      status: "confirmed",
      tx_signature: txSignature,
      next_attempt_at: null,
      last_error: null,
    })
    .returning("*");
  if (report.is_baseline)
    await db("submissions")
      .where({ id: submission.id })
      .whereNull("baseline_views")
      .update({ baseline_views: report.view_count });
  await db("claim_requests")
    .where({ submission_id: submission.id, status: "PENDING" })
    .update({ status: "READY", updated_at: new Date() });
  await createNotification(db, {
    wallet: submission.clipper_wallet,
    type: report.is_baseline ? "BASELINE_READY" : "CLAIM_REPORT_READY",
    payload: { submissionId: submission.id, txSignature },
    dedupeKey: `oracle-report:${report.id}`,
  });
  return confirmed;
}

async function markDispatchFailure(report, error) {
  const attempts = Number(report.attempts || 0) + 1;
  const delaySeconds = Math.min(300, 2 ** Math.min(attempts, 8));
  await db("oracle_reports")
    .where({ id: report.id })
    .update({
      status: "failed",
      attempts,
      last_error: String(error.message || error).slice(0, 2000),
      next_attempt_at: new Date(Date.now() + delaySeconds * 1000),
    });
}

export async function dispatchOracleReportById(reportId) {
  const row = await db("oracle_reports as r")
    .join("submissions as s", "s.id", "r.submission_id")
    .join("campaigns as c", "c.id", "s.campaign_id")
    .select(
      "r.*",
      "s.onchain_submission",
      "s.clipper_wallet",
      "c.onchain_campaign"
    )
    .where("r.id", reportId)
    .first();
  if (!row) throw new Error("Oracle report not found");
  if (!["pending", "failed"].includes(row.status)) return row;
  try {
    return await dispatch(row, row);
  } catch (error) {
    await markDispatchFailure(row, error);
    throw error;
  }
}

export async function retryFailedOracleReports(limit = 20) {
  if (!oracleSubmitEnabled()) return [];
  const rows = await db("oracle_reports")
    .select("id")
    .where({ status: "failed" })
    .where((query) =>
      query
        .whereNull("next_attempt_at")
        .orWhere("next_attempt_at", "<=", new Date())
    )
    .orderBy("created_at", "asc")
    .limit(limit);
  const results = [];
  for (const row of rows) {
    try {
      results.push(await dispatchOracleReportById(row.id));
    } catch (error) {
      results.push({ id: row.id, status: "failed", error: error.message });
    }
  }
  return results;
}

export async function runOracle({ submissionId, reason = "manual" } = {}) {
  const now = new Date();
  const reporter = await getOracleReporter();
  const query = db("submissions as s")
    .join("campaigns as c", "c.id", "s.campaign_id")
    .select(
      "s.*",
      "c.end_time",
      "c.final_snapshot_tolerance",
      "c.appeal_window",
      "c.onchain_campaign"
    )
    .whereNot("s.status", "REJECTED_FINAL");
  if (submissionId) query.where("s.id", submissionId);
  const submissions = await query;
  const eligible = submissions.filter(
    (item) =>
      !(
        item.status === "REJECTED" &&
        !item.appealed_at &&
        item.rejected_at &&
        now.getTime() >
          new Date(item.rejected_at).getTime() + item.appeal_window * 1000
      )
  );
  const videos = await youtubeService.getVideosBatch(
    eligible.map((item) => item.youtube_video_id)
  );
  const results = [];

  for (const submission of eligible) {
    const video = videos.get(submission.youtube_video_id);
    if (!video) {
      results.push({
        submissionId: submission.id,
        status: "skipped",
        reason: "video unavailable",
      });
      continue;
    }
    const snapshots = await db("view_snapshots")
      .where({ submission_id: submission.id })
      .andWhere("fetched_at", ">=", new Date(Date.now() - 86_400_000))
      .orderBy("fetched_at", "desc")
      .limit(50);
    const holdReason = detectAnomaly({
      snapshots,
      nextViewCount: video.viewCount,
      maxGrowthPerHour: Number(
        process.env.ANOMALY_MAX_GROWTH_PER_HOUR || 100000
      ),
      multiplier: Number(process.env.ANOMALY_MULTIPLIER || 10),
    });
    await db("view_snapshots").insert({
      submission_id: submission.id,
      view_count: video.viewCount,
      availability: video.availability,
      fetched_at: video.fetchTime,
      flagged: Boolean(holdReason),
    });
    const lastConfirmed = await db("oracle_reports")
      .where({
        submission_id: submission.id,
        status: "confirmed",
        reporter: reporter,
      })
      .orderBy("fetched_at", "desc")
      .first();
    if (lastConfirmed?.is_final) {
      results.push({
        submissionId: submission.id,
        status: "skipped",
        reason: "final report already confirmed",
      });
      continue;
    }
    if (reason === "schedule" && submission.baseline_views != null) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const tolerance = Number(submission.final_snapshot_tolerance);
      const pendingClaim = await db("claim_requests")
        .where({ submission_id: submission.id, status: "PENDING" })
        .first();
      const finalDue = nowSeconds > Number(submission.end_time);
      const nearEnd = nowSeconds >= Number(submission.end_time) - tolerance;
      const alreadyHasNearEnd =
        lastConfirmed &&
        Math.floor(new Date(lastConfirmed.fetched_at).getTime() / 1000) >=
          Number(submission.end_time) - tolerance;
      if (!pendingClaim && !finalDue && (!nearEnd || alreadyHasNearEnd)) {
        results.push({
          submissionId: submission.id,
          status: "snapshotted",
          reason: "no on-chain report due",
        });
        continue;
      }
    }
    const reportedViews = Math.max(
      video.viewCount,
      Number(lastConfirmed?.view_count ?? 0)
    );
    const end = Number(submission.end_time);
    const fetched = await getSafeOracleTimestamp(video.fetchTime);
    if (fetched > end + Number(submission.final_snapshot_tolerance)) {
      results.push({
        submissionId: submission.id,
        status: "skipped",
        reason: "final snapshot window closed",
      });
      continue;
    }
    const isBaseline = submission.baseline_views == null;
    const isFinal = !isBaseline && fetched > end;
    const [report] = await db("oracle_reports")
      .insert({
        submission_id: submission.id,
        view_count: reportedViews,
        fetched_at: new Date(fetched * 1000),
        is_final: isFinal,
        is_baseline: isBaseline,
        reporter: reporter,
        status: holdReason ? "held" : "pending",
        hold_reason: holdReason,
      })
      .returning("*");
    if (holdReason) {
      await createNotification(db, {
        wallet: submission.clipper_wallet,
        type: "ORACLE_REPORT_HELD",
        payload: {
          submissionId: submission.id,
          reportId: report.id,
          reason: holdReason,
        },
        dedupeKey: "oracle-held:" + report.id,
      });
      await db("claim_requests")
        .where({ submission_id: submission.id, status: "PENDING" })
        .update({
          status: "FAILED",
          error_code: "REPORT_HELD",
          updated_at: new Date(),
        });
      results.push(report);
      continue;
    }
    try {
      results.push(await dispatch(report, submission));
    } catch (error) {
      await markDispatchFailure(report, error);
      results.push({ ...report, status: "failed", error: error.message });
    }
  }
  return results;
}
