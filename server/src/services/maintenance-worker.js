import { db } from "../db/index.js";
import { runOracle, retryFailedOracleReports } from "./oracle-worker.js";
import { createDeadlineReminders } from "./notifications.js";

let timer;
let running = false;

export async function purgeExpiredPlatformData(now = new Date()) {
  const retentionDays = Number(process.env.YOUTUBE_DATA_RETENTION_DAYS || 30);
  const cutoffSeconds =
    Math.floor(now.getTime() / 1000) - retentionDays * 86_400;
  const eligible = db("campaigns")
    .select("id")
    .where("status", "CLOSED")
    .orWhereRaw("end_time + settlement_period < ?", [cutoffSeconds]);
  const submissions = db("submissions")
    .select("id")
    .whereIn("campaign_id", eligible);
  const deletedSnapshots = await db("view_snapshots")
    .whereIn("submission_id", submissions)
    .andWhere("fetched_at", "<", now)
    .delete();
  return { deletedSnapshots };
}

export async function runMaintenanceCycle() {
  if (running) return { skipped: "already-running" };
  running = true;
  try {
    const result = {};
    if (process.env.ORACLE_WORKER_ENABLED === "true") {
      result.retries = await retryFailedOracleReports();
      result.oracle = await runOracle({ reason: "schedule" });
    }
    result.reminders = await createDeadlineReminders();
    const hour = new Date().getUTCHours();
    if (hour === 0) result.retention = await purgeExpiredPlatformData();
    return result;
  } finally {
    running = false;
  }
}

export function startMaintenanceWorker(logger = console) {
  if (process.env.WORKERS_ENABLED !== "true") return () => {};
  const intervalMs = Math.max(
    Number(process.env.WORKER_INTERVAL_SECONDS || 60) * 1000,
    5_000
  );
  const execute = () =>
    runMaintenanceCycle().catch((error) =>
      logger.error?.({ err: error }, "Background maintenance cycle failed")
    );
  timer = setInterval(execute, intervalMs);
  timer.unref();
  execute();
  return stopMaintenanceWorker;
}

export function stopMaintenanceWorker() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
