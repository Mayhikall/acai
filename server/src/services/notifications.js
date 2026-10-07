import { db } from "../db/index.js";

export async function createNotification(
  client,
  { wallet, type, payload, dedupeKey = null }
) {
  const query = client("notifications").insert({
    wallet,
    type,
    payload,
    dedupe_key: dedupeKey,
  });
  if (dedupeKey) query.onConflict("dedupe_key").ignore();
  await query;
}

export async function createDeadlineReminders(now = new Date()) {
  const leadSeconds = Number(process.env.NOTIFICATION_REMINDER_SECONDS || 60);
  const upper = new Date(now.getTime() + leadSeconds * 1000);
  const pendingReviews = await db("submissions as s")
    .join("campaigns as c", "c.id", "s.campaign_id")
    .select("s.id", "s.review_deadline", "c.creator_wallet")
    .where("s.status", "PENDING_REVIEW")
    .andWhere("s.review_deadline", ">", now)
    .andWhere("s.review_deadline", "<=", upper);
  for (const item of pendingReviews)
    await createNotification(db, {
      wallet: item.creator_wallet,
      type: "REVIEW_DEADLINE_REMINDER",
      payload: { submissionId: item.id, deadline: item.review_deadline },
      dedupeKey: `review-deadline:${item.id}`,
    });

  const appeals = await db("submissions as s")
    .join("campaigns as c", "c.id", "s.campaign_id")
    .select("s.id", "s.appealed_at", "c.appeal_timeout", "c.creator_wallet")
    .where("s.status", "REJECTED")
    .whereNotNull("s.appealed_at");
  const baselineThreshold = new Date(
    now.getTime() - Number(process.env.BASELINE_ALERT_SECONDS || 300) * 1000
  );
  const missingBaselines = await db("submissions as s")
    .join("campaigns as c", "c.id", "s.campaign_id")
    .select("s.id", "s.clipper_wallet", "c.creator_wallet")
    .whereNull("s.baseline_views")
    .andWhere("s.submitted_at", "<=", baselineThreshold)
    .whereNot("s.status", "REJECTED_FINAL");
  for (const item of missingBaselines) {
    for (const wallet of [item.clipper_wallet, item.creator_wallet])
      await createNotification(db, {
        wallet,
        type: "BASELINE_DELAYED",
        payload: { submissionId: item.id },
        dedupeKey: "baseline-delayed:" + item.id + ":" + wallet,
      });
  }

  for (const item of appeals) {
    const deadline = new Date(
      new Date(item.appealed_at).getTime() + Number(item.appeal_timeout) * 1000
    );
    if (deadline > now && deadline <= upper)
      await createNotification(db, {
        wallet: item.creator_wallet,
        type: "APPEAL_DEADLINE_REMINDER",
        payload: { submissionId: item.id, deadline },
        dedupeKey: `appeal-deadline:${item.id}`,
      });
  }
}
