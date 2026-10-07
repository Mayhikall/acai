use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum CampaignStatus {
    PendingFunding,
    Funded,
    Closed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum SubmissionStatus {
    PendingReview,
    Rejected,
    Accepted,
    RejectedFinal,
}

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub pending_admin: Option<Pubkey>,
    pub oracle: Pubkey,
    pub bump: u8,
}

impl Config {
    // 8 discriminator + 32 admin + (1 + 32) pending_admin + 32 oracle + 1 bump = 106
    pub const LEN: usize = 8 + 32 + 33 + 32 + 1;
}

#[account]
pub struct Campaign {
    pub campaign_id: u64,
    pub creator: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub terms_hash: [u8; 32],
    pub cpm: u64,
    pub max_payout_per_video: u64,
    pub budget: u64,
    pub total_funded: u64,
    pub total_paid: u64,
    pub start_time: i64,
    pub end_time: i64,

    // Time parameters (Section 4.1)
    pub review_period: i64,
    pub appeal_window: i64,
    pub appeal_timeout: i64,
    pub settlement_period: i64,
    pub max_report_age: i64,
    pub final_snapshot_tolerance: i64,
    pub clock_skew_tolerance: i64,
    pub max_videos_per_clipper: u16,

    pub status: CampaignStatus,
    pub bump: u8,
}

impl Campaign {
    // 8 + 8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + (7 * 8) + 2 + 1 + 1 = 266
    pub const LEN: usize = 8 + 8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 56 + 2 + 1 + 1;
}

#[account]
pub struct Submission {
    pub campaign: Pubkey,
    pub clipper: Pubkey,
    pub video_id: String, // YouTube video id (11 chars)
    pub terms_hash: [u8; 32],
    pub status: SubmissionStatus,
    pub submitted_at: i64,
    pub review_deadline: i64,
    pub rejected_at: Option<i64>,
    pub reason_hash: Option<[u8; 32]>,
    pub appealed_at: Option<i64>,
    pub accepted_at: Option<i64>,
    pub baseline_views: Option<u64>,
    pub total_paid: u64,
    pub bump: u8,
}

impl Submission {
    // 8 discriminator
    // 32 campaign + 32 clipper + (4 + 11) video_id + 32 terms_hash + 1 status
    // + 8 submitted_at + 8 review_deadline
    // + (1 + 8) rejected_at + (1 + 32) reason_hash + (1 + 8) appealed_at + (1 + 8) accepted_at
    // + (1 + 8) baseline_views + 8 total_paid + 1 bump = 210
    pub const LEN: usize = 8 + 32 + 32 + 15 + 32 + 1 + 8 + 8 + 9 + 33 + 9 + 9 + 9 + 8 + 1;
}

#[account]
pub struct ClipperStats {
    pub active_count: u16,
    pub total_submitted: u16,
}

impl ClipperStats {
    // 8 discriminator + 2 active_count + 2 total_submitted = 12
    pub const LEN: usize = 8 + 2 + 2;
}

#[account]
pub struct OracleReport {
    pub campaign: Pubkey,
    pub submission: Pubkey,
    pub view_count: u64,
    pub fetched_at: i64,
    pub report_seq: u64,
    pub is_final: bool,
    pub reporter: Pubkey,
}

impl OracleReport {
    // 8 discriminator + 32 campaign + 32 submission + 8 view_count + 8 fetched_at
    // + 8 report_seq + 1 is_final + 32 reporter = 129
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 32;
}
