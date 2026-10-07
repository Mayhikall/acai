import { deriveCampaignAddress } from "../../services/transaction-intents.js";

export async function seed(knex) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seed is disabled in production");
  const creator = "11111111111111111111111111111111";
  const clipper = "So11111111111111111111111111111111111111112";
  const now = Math.floor(Date.now() / 1000);
  const onchainCampaign = await deriveCampaignAddress(creator, "1");

  await knex("users")
    .insert([{ wallet: creator }, { wallet: clipper }])
    .onConflict("wallet")
    .ignore();
  await knex("youtube_channels")
    .insert({
      wallet: clipper,
      channel_id: "UC_MOCK_CHANNEL_123",
      title: "Acai Demo Clipper",
      subscriber_count: 2500,
      channel_created_at: "2023-01-01T00:00:00.000Z",
      uploads_playlist_id: "UU_MOCK_UPLOADS",
      refresh_token_encrypted: "mock",
    })
    .onConflict("channel_id")
    .ignore();
  await knex("campaigns")
    .insert({
      id: "1",
      creator_wallet: creator,
      title: "Acai demo campaign",
      brief: "Create a short clip from the source video.",
      source_video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      required_mention: "@acai_creator_podcast",
      payment_mint: "11111111111111111111111111111111",
      terms_file_path: "1/terms.pdf",
      terms_hash: "0".repeat(64),
      cpm: "2000000",
      max_payout_per_video: "50000000",
      budget: "60000000",
      total_funded: "60000000",
      start_time: now - 60,
      end_time: now + 1200,
      review_period: 180,
      appeal_window: 120,
      appeal_timeout: 180,
      settlement_period: 180,
      max_report_age: 600,
      final_snapshot_tolerance: 60,
      clock_skew_tolerance: 10,
      max_videos_per_clipper: 5,
      min_subscribers: 0,
      min_channel_age_days: 0,
      status: "FUNDED",
      onchain_campaign: onchainCampaign,
    })
    .onConflict("id")
    .merge({ onchain_campaign: onchainCampaign });

  await knex.raw(`
    SELECT setval(
      'campaign_id_seq',
      GREATEST(COALESCE((SELECT MAX(id) FROM campaigns), 0) + 1, 1),
      false
    )
  `);
}
