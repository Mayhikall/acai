export type Campaign = {
  id: string;
  creator_wallet: string;
  title: string;
  brief: string;
  source_video: string;
  required_mention: string;
  payment_mint: string;
  terms_hash: string;
  cpm: string;
  max_payout_per_video: string;
  budget: string;
  total_funded: string;
  total_paid: string;
  start_time: string | number;
  end_time: string | number;
  status: "PENDING_FUNDING" | "FUNDED" | "CLOSED";
  max_videos_per_clipper: number;
  min_subscribers?: number | null;
  min_channel_age_days?: number | null;
  onchain_campaign?: string | null;
  created_at: string;
};

export type CampaignIntent = {
  campaignId: string;
  title: string;
  budget: string;
  status:
    "AWAITING_SIGNATURE" | "SUBMITTED" | "INITIALIZED" | "EXPIRED" | "FAILED";
  txSignature?: string | null;
  expiresAt: string;
  createdAt: string;
};

export type Submission = {
  id: number;
  campaign_id: string;
  campaign_title?: string;
  clipper_wallet: string;
  youtube_video_id: string;
  title: string;
  status: "PENDING_REVIEW" | "REJECTED" | "ACCEPTED" | "REJECTED_FINAL";
  onchain_submission?: string | null;
  submitted_at: string;
  review_deadline: string;
  rejected_at?: string | null;
  appealed_at?: string | null;
  accepted_at?: string | null;
  baseline_views?: string | null;
  total_paid: string;
};

export type YouTubeVideo = {
  videoId: string;
  channelId: string;
  title: string;
  thumbnailUrl?: string;
  description: string;
  publishedAt: string | null;
  durationSeconds: number;
  availability: string;
  viewCount: number;
};

export type Notification = {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  read_at?: string | null;
  created_at: string;
};
