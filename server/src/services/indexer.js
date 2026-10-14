import { db } from "../db/index.js";
import { AppError } from "../lib/errors.js";
import { createNotification } from "./notifications.js";
import { deriveSubmissionAddress } from "./transaction-intents.js";

const asDate = (seconds) => new Date(Number(seconds) * 1000);

export function assertCampaignIntentMatchesEvent(intent, payload, txSignature) {
  const data = intent.campaign_data;
  const mismatches = [
    [payload.creator, intent.creator_wallet],
    [String(payload.budget), String(data.budget)],
    [String(payload.cpm), String(data.cpm)],
    [String(payload.max_payout_per_video), String(data.max_payout_per_video)],
    [String(payload.start_time), String(data.start_time)],
    [String(payload.end_time), String(data.end_time)],
  ];
  if (mismatches.some(([actual, expected]) => actual !== expected))
    throw new AppError(
      409,
      "CAMPAIGN_INTENT_MISMATCH",
      "Finalized campaign does not match its verified intent"
    );
  if (intent.tx_signature && intent.tx_signature !== txSignature)
    throw new AppError(
      409,
      "CAMPAIGN_SIGNATURE_MISMATCH",
      "Finalized transaction does not match the submitted signature"
    );
}

async function findSubmission(trx, payload) {
  const query = trx("submissions");
  if (payload.submission)
    query.where({ onchain_submission: payload.submission });
  else
    query.where({
      campaign_id: String(payload.campaign_id),
      youtube_video_id: payload.video_id,
    });
  return query.first();
}

export async function processIndexerEvent({
  txSignature,
  eventIndex,
  eventName,
  payload,
}) {
  return db.transaction(async (trx) => {
    const inserted = await trx("indexer_events")
      .insert({
        tx_signature: txSignature,
        event_index: eventIndex,
        event_name: eventName,
        payload,
      })
      .onConflict(["tx_signature", "event_index"])
      .ignore()
      .returning("event_name");
    if (!inserted.length) return { duplicate: true };
    let affectedSubmissionId = null;

    if (eventName === "CampaignInitialized") {
      const campaignId = String(payload.campaign_id);
      const intent = await trx("campaign_intents")
        .where({ campaign_id: campaignId })
        .first();
      if (!intent)
        throw new AppError(
          409,
          "CAMPAIGN_INTENT_MISSING",
          "No campaign intent matches the finalized event"
        );
      assertCampaignIntentMatchesEvent(intent, payload, txSignature);
      await trx("campaigns")
        .insert({
          id: campaignId,
          ...intent.campaign_data,
          terms_file_path: intent.terms_file_path,
          terms_hash: intent.terms_hash,
          creator_wallet: intent.creator_wallet,
          onchain_campaign: intent.onchain_campaign,
          status: "PENDING_FUNDING",
        })
        .onConflict("id")
        .ignore();
      await trx("campaign_intents").where({ campaign_id: campaignId }).update({
        status: "INITIALIZED",
        tx_signature: txSignature,
        updated_at: trx.fn.now(),
      });
    } else if (eventName === "SubmissionRegistered") {
      const intent = await trx("submission_intents")
        .where({
          campaign_id: String(payload.campaign_id),
          youtube_video_id: payload.video_id,
          clipper_wallet: payload.clipper,
        })
        .first();
      if (!intent)
        throw new AppError(
          409,
          "SUBMISSION_INTENT_MISSING",
          "No verified submission intent matches the event"
        );
      const campaign = await trx("campaigns")
        .where({ id: intent.campaign_id })
        .first();
      const onchainSubmission =
        payload.submission ??
        (await deriveSubmissionAddress(
          campaign.onchain_campaign,
          intent.youtube_video_id
        ));
      const [submission] = await trx("submissions")
        .insert({
          campaign_id: intent.campaign_id,
          clipper_wallet: intent.clipper_wallet,
          youtube_video_id: intent.youtube_video_id,
          channel_id: intent.channel_id,
          title: intent.title,
          published_at: intent.published_at,
          status: "PENDING_REVIEW",
          onchain_submission: onchainSubmission,
          submitted_at: asDate(payload.submitted_at),
          review_deadline: asDate(payload.review_deadline),
          terms_hash: intent.terms_hash,
          register_tx: txSignature,
        })
        .returning("*");
      affectedSubmissionId = submission.id;
      await trx("clipper_stats")
        .insert({
          campaign_id: intent.campaign_id,
          clipper_wallet: intent.clipper_wallet,
          active_count: 1,
          total_submitted: 1,
        })
        .onConflict(["campaign_id", "clipper_wallet"])
        .merge({
          active_count: trx.raw("clipper_stats.active_count + 1"),
          total_submitted: trx.raw("clipper_stats.total_submitted + 1"),
        });
      await trx("notifications").insert({
        wallet: campaign.creator_wallet,
        type: "SUBMISSION_NEW",
        payload: { submissionId: submission.id },
      });
      await trx("submission_intents").where({ id: intent.id }).delete();
    } else if (
      ["SubmissionAccepted", "SubmissionFinalized"].includes(eventName)
    ) {
      const submission = await findSubmission(trx, payload);
      if (submission)
        await trx("submissions")
          .where({ id: submission.id })
          .update({
            status: "ACCEPTED",
            accepted_at: asDate(payload.accepted_at),
          });
    } else if (eventName === "SubmissionRejected") {
      const submission = await findSubmission(trx, payload);
      if (submission) {
        await trx("submissions")
          .where({ id: submission.id })
          .update({
            status: payload.is_final ? "REJECTED_FINAL" : "REJECTED",
            rejected_at: trx.fn.now(),
            reason_hash: Array.isArray(payload.reason_hash)
              ? Buffer.from(payload.reason_hash).toString("hex")
              : payload.reason_hash,
          });
        await trx("clipper_stats")
          .where({
            campaign_id: submission.campaign_id,
            clipper_wallet: submission.clipper_wallet,
          })
          .update({ active_count: trx.raw("GREATEST(active_count - 1, 0)") });
      }
    } else if (eventName === "SubmissionAppealed") {
      const submission = await findSubmission(trx, payload);
      if (submission) {
        await trx("submissions")
          .where({ id: submission.id })
          .update({ appealed_at: asDate(payload.appealed_at) });
        await trx("clipper_stats")
          .where({
            campaign_id: submission.campaign_id,
            clipper_wallet: submission.clipper_wallet,
          })
          .increment("active_count", 1);
      }
    } else if (eventName === "OracleReportSubmitted") {
      const submission = await findSubmission(trx, payload);
      if (submission) {
        const confirmed = await trx("oracle_reports")
          .where({ submission_id: submission.id, tx_signature: txSignature })
          .first();
        const pending =
          confirmed ??
          (await trx("oracle_reports")
            .where({ submission_id: submission.id })
            .whereIn("status", ["pending", "failed"])
            .orderBy("created_at", "desc")
            .first());
        const values = {
          report_seq: String(payload.report_seq),
          view_count: String(payload.view_count),
          fetched_at: asDate(payload.fetched_at),
          is_final: payload.is_final,
          is_baseline: payload.is_baseline,
          reporter: payload.reporter,
          tx_signature: txSignature,
          status: "confirmed",
          hold_reason: null,
        };
        if (pending)
          await trx("oracle_reports").where({ id: pending.id }).update(values);
        else
          await trx("oracle_reports").insert({
            submission_id: submission.id,
            ...values,
          });
        if (payload.is_baseline)
          await trx("submissions")
            .where({ id: submission.id })
            .whereNull("baseline_views")
            .update({ baseline_views: String(payload.view_count) });
        await trx("claim_requests")
          .where({ submission_id: submission.id, status: "PENDING" })
          .update({ status: "READY", updated_at: trx.fn.now() });
      }
    } else if (eventName === "Claimed") {
      const submission = await findSubmission(trx, payload);
      if (submission) {
        await trx("claims")
          .insert({
            submission_id: submission.id,
            amount: String(payload.amount),
            remaining_claim: String(payload.remaining_claim),
            tx_signature: txSignature,
          })
          .onConflict("tx_signature")
          .ignore();
        await trx("submissions")
          .where({ id: submission.id })
          .increment("total_paid", String(payload.amount));
        await trx("campaigns")
          .where({ id: submission.campaign_id })
          .increment("total_paid", String(payload.amount));
        await trx("claim_requests")
          .where({ submission_id: submission.id, status: "READY" })
          .update({ status: "DONE", updated_at: trx.fn.now() });
      }
    } else if (eventName === "CampaignFunded") {
      const campaignId = String(payload.campaign_id);
      const intent = await trx("campaign_intents")
        .where({ campaign_id: campaignId })
        .first();
      const campaign = await trx("campaigns").where({ id: campaignId }).first();
      if (!intent || !campaign)
        throw new AppError(
          409,
          "CAMPAIGN_INITIALIZATION_MISSING",
          "Campaign funding was finalized without a matching initialization"
        );
      if (
        payload.creator !== campaign.creator_wallet ||
        String(payload.amount) !== String(campaign.budget) ||
        (intent.tx_signature && intent.tx_signature !== txSignature)
      )
        throw new AppError(
          409,
          "CAMPAIGN_FUNDING_MISMATCH",
          "Finalized campaign funding does not match its verified intent"
        );
      await trx("campaigns")
        .where({ id: campaignId })
        .update({
          status: "FUNDED",
          total_funded: String(payload.amount),
        });
      await trx("campaign_intents")
        .where({ campaign_id: campaignId })
        .update({ status: "FINALIZED", updated_at: trx.fn.now() });
    } else if (eventName === "CampaignToppedUp") {
      await trx("campaigns")
        .where({ id: String(payload.campaign_id) })
        .update({ total_funded: String(payload.total_funded) });
    } else if (["Refunded", "CampaignClosed"].includes(eventName)) {
      await trx("campaigns")
        .where({ id: String(payload.campaign_id) })
        .update({ status: "CLOSED" });
    }
    const submissionEvents = new Set([
      "SubmissionAccepted",
      "SubmissionRejected",
      "SubmissionAppealed",
      "SubmissionFinalized",
      "OracleReportSubmitted",
      "Claimed",
    ]);
    if (submissionEvents.has(eventName)) {
      const affected = await findSubmission(trx, payload);
      if (affected) {
        affectedSubmissionId = affected.id;
        let wallet = affected.clipper_wallet;
        let type = null;
        if (["SubmissionAccepted", "SubmissionFinalized"].includes(eventName))
          type = "SUBMISSION_ACCEPTED";
        else if (eventName === "SubmissionRejected")
          type = payload.is_final
            ? "SUBMISSION_REJECTED_FINAL"
            : "SUBMISSION_REJECTED";
        else if (eventName === "SubmissionAppealed") {
          type = "SUBMISSION_APPEALED";
          const campaign = await trx("campaigns")
            .where({ id: affected.campaign_id })
            .first();
          wallet = campaign?.creator_wallet;
        } else if (eventName === "OracleReportSubmitted")
          type = payload.is_baseline ? "BASELINE_READY" : "CLAIM_REPORT_READY";
        else if (eventName === "Claimed") type = "CLAIM_CONFIRMED";
        if (type && wallet)
          await createNotification(trx, {
            wallet,
            type,
            payload: { submissionId: affected.id, txSignature },
            dedupeKey: "event:" + txSignature + ":" + eventIndex + ":" + type,
          });
      }
    }
    return { duplicate: false, submissionId: affectedSubmissionId };
  });
}
