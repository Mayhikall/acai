use anchor_lang::prelude::*;

#[event]
pub struct OracleUpdated {
    pub old_oracle: Pubkey,
    pub new_oracle: Pubkey,
}

#[event]
pub struct AdminProposed {
    pub current_admin: Pubkey,
    pub pending_admin: Pubkey,
}

#[event]
pub struct AdminTransferred {
    pub old_admin: Pubkey,
    pub new_admin: Pubkey,
}

#[event]
pub struct CampaignInitialized {
    pub campaign_id: u64,
    pub creator: Pubkey,
    pub budget: u64,
    pub cpm: u64,
    pub max_payout_per_video: u64,
    pub start_time: i64,
    pub end_time: i64,
}

#[event]
pub struct CampaignFunded {
    pub campaign_id: u64,
    pub creator: Pubkey,
    pub amount: u64,
}

#[event]
pub struct CampaignToppedUp {
    pub campaign_id: u64,
    pub creator: Pubkey,
    pub amount: u64,
    pub total_funded: u64,
}

#[event]
pub struct CampaignClosed {
    pub campaign_id: u64,
    pub creator: Pubkey,
}

#[event]
pub struct SubmissionRegistered {
    pub campaign_id: u64,
    pub clipper: Pubkey,
    pub video_id: String,
    pub submitted_at: i64,
    pub review_deadline: i64,
}

#[event]
pub struct SubmissionAccepted {
    pub campaign_id: u64,
    pub video_id: String,
    pub clipper: Pubkey,
    pub accepted_at: i64,
}

#[event]
pub struct SubmissionRejected {
    pub campaign_id: u64,
    pub video_id: String,
    pub clipper: Pubkey,
    pub reason_hash: [u8; 32],
    pub is_final: bool,
}

#[event]
pub struct SubmissionAppealed {
    pub campaign_id: u64,
    pub video_id: String,
    pub clipper: Pubkey,
    pub appealed_at: i64,
}

#[event]
pub struct SubmissionFinalized {
    pub campaign_id: u64,
    pub video_id: String,
    pub accepted_at: i64,
}

#[event]
pub struct OracleReportSubmitted {
    pub submission: Pubkey,
    pub view_count: u64,
    pub fetched_at: i64,
    pub report_seq: u64,
    pub is_final: bool,
    pub is_baseline: bool,
    pub reporter: Pubkey,
}

#[event]
pub struct Claimed {
    pub campaign_id: u64,
    pub clipper: Pubkey,
    pub video_id: String,
    pub amount: u64,
    pub remaining_claim: u64,
}

#[event]
pub struct Refunded {
    pub campaign_id: u64,
    pub creator: Pubkey,
    pub amount: u64,
}
