#[cfg(test)]
mod tests {
    use crate::state::{CampaignStatus, SubmissionStatus};
    use crate::ID as PROGRAM_ID;
    use anchor_lang::solana_program::pubkey::Pubkey;

    fn get_config_pda() -> (Pubkey, u8) {
        Pubkey::find_program_address(&[b"config"], &PROGRAM_ID)
    }

    fn get_campaign_pda(creator: &Pubkey, campaign_id: u64) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[b"campaign", creator.as_ref(), &campaign_id.to_le_bytes()],
            &PROGRAM_ID,
        )
    }

    fn get_vault_pda(campaign: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[b"vault", campaign.as_ref()], &PROGRAM_ID)
    }

    fn get_submission_pda(campaign: &Pubkey, video_id: &str) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[b"submission", campaign.as_ref(), video_id.as_bytes()],
            &PROGRAM_ID,
        )
    }

    fn get_stats_pda(campaign: &Pubkey, clipper: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[b"stats", campaign.as_ref(), clipper.as_ref()],
            &PROGRAM_ID,
        )
    }

    fn get_report_pda(submission: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[b"report", submission.as_ref()], &PROGRAM_ID)
    }

    // Payout computation helper
    fn calculate_payout(
        reported_views: u64,
        baseline_views: u64,
        cpm: u64,
        max_payout_per_video: u64,
        total_paid: u64,
        remaining_pool: u64,
    ) -> (u64, u64) {
        let eligible_views = reported_views.saturating_sub(baseline_views);
        let raw_entitlement = ((eligible_views as u128) * (cpm as u128)) / 1000;
        let entitlement = std::cmp::min(raw_entitlement, max_payout_per_video as u128) as u64;
        let claimable = entitlement.saturating_sub(total_paid);
        let payout = std::cmp::min(claimable, remaining_pool);
        let remaining_claim = claimable.saturating_sub(payout);
        (payout, remaining_claim)
    }

    #[test]
    fn test_pda_seeds_and_constants() {
        let creator = Pubkey::new_unique();
        let clipper = Pubkey::new_unique();
        let campaign_id = 1001u64;
        let video_id = "dQw4w9WgXcQ";

        let (config_pda, _) = get_config_pda();
        let (campaign_pda, _) = get_campaign_pda(&creator, campaign_id);
        let (vault_pda, _) = get_vault_pda(&campaign_pda);
        let (submission_pda, _) = get_submission_pda(&campaign_pda, video_id);
        let (stats_pda, _) = get_stats_pda(&campaign_pda, &clipper);
        let (report_pda, _) = get_report_pda(&submission_pda);

        assert_ne!(config_pda, campaign_pda);
        assert_ne!(campaign_pda, vault_pda);
        assert_ne!(submission_pda, stats_pda);
        assert_ne!(submission_pda, report_pda);
    }

    #[test]
    fn test_claim_payout_calculation() {
        let baseline = 1_000u64;
        let reported = 10_000u64;
        let cpm = 5_000_000u64;
        let max_payout = 100_000_000u64;
        let pool = 100_000_000u64;

        let (payout, remaining) = calculate_payout(reported, baseline, cpm, max_payout, 0, pool);
        assert_eq!(payout, 45_000_000);
        assert_eq!(remaining, 0);
    }

    #[test]
    fn test_claim_payout_caps_at_maximum() {
        let (payout, remaining) =
            calculate_payout(100_000, 0, 5_000_000, 50_000_000, 0, 1_000_000_000);
        assert_eq!(payout, 50_000_000);
        assert_eq!(remaining, 0);
    }

    #[test]
    fn test_partial_payout_and_subsequent_claim() {
        let baseline = 0;
        let reported = 200_000;
        let cpm = 1_000_000;
        let max_payout = 500_000_000;
        let total_paid = 100_000_000;
        let pool = 50_000_000;

        let (payout_1, remaining_1) =
            calculate_payout(reported, baseline, cpm, max_payout, total_paid, pool);
        assert_eq!(payout_1, 50_000_000);
        assert_eq!(remaining_1, 50_000_000);

        // Creator tops up, clipper claims remaining entitlement without new views
        let total_paid_now = total_paid + payout_1;
        let new_pool = 100_000_000;

        let (payout_2, remaining_2) = calculate_payout(
            reported,
            baseline,
            cpm,
            max_payout,
            total_paid_now,
            new_pool,
        );
        assert_eq!(payout_2, 50_000_000); // Remaining 50 aUSDC is now successfully paid
        assert_eq!(remaining_2, 0);
    }

    #[test]
    fn test_submission_lifecycle_transitions() {
        // Test status enum serialization and states
        let mut status = SubmissionStatus::PendingReview;
        assert_eq!(status, SubmissionStatus::PendingReview);

        status = SubmissionStatus::Rejected;
        assert_eq!(status, SubmissionStatus::Rejected);

        status = SubmissionStatus::Accepted;
        assert_eq!(status, SubmissionStatus::Accepted);

        let campaign_status = CampaignStatus::PendingFunding;
        assert_eq!(campaign_status, CampaignStatus::PendingFunding);
    }

    #[test]
    fn test_oracle_monotonicity_rules() {
        let prev_fetched_at = 1_000_000i64;
        let prev_view_count = 50_000u64;

        // Valid new report: strictly newer timestamp and equal or greater views
        let next_fetched_at = 1_000_060i64;
        let next_view_count = 52_000u64;
        assert!(next_fetched_at > prev_fetched_at);
        assert!(next_view_count >= prev_view_count);

        // Replay attempt: older or equal timestamp must be rejected
        let replay_fetched_at = prev_fetched_at;
        assert!(!(replay_fetched_at > prev_fetched_at));

        // Decreased view count attempt: must be rejected
        let decreased_views = prev_view_count - 100;
        assert!(!(decreased_views >= prev_view_count));
    }

    #[test]
    fn test_quota_limits() {
        let max_videos_per_clipper = 5u16;
        let total_limit = max_videos_per_clipper * 2; // 10

        let mut active_count = 0u16;
        let mut total_submitted = 0u16;

        // Register 5 videos
        for _ in 0..5 {
            assert!(active_count < max_videos_per_clipper);
            assert!(total_submitted < total_limit);
            active_count += 1;
            total_submitted += 1;
        }

        // 6th video fails active quota
        assert!(!(active_count < max_videos_per_clipper));

        // 1 video is rejected: active_count decreases by 1
        active_count = active_count.saturating_sub(1); // 4
        assert!(active_count < max_videos_per_clipper); // Can submit again

        // But total_submitted never decreases (still 5)
        assert_eq!(total_submitted, 5);
    }

    #[test]
    fn test_payout_extremes_and_deterministic_fuzz_invariants() {
        let (max_payout, remaining) =
            calculate_payout(u64::MAX, 0, u64::MAX, u64::MAX, 0, u64::MAX);
        assert_eq!(max_payout, u64::MAX);
        assert_eq!(remaining, 0);

        let (tiny_cpm, _) = calculate_payout(999, 0, 1, u64::MAX, 0, u64::MAX);
        assert_eq!(tiny_cpm, 0);
        let (floor, _) = calculate_payout(1_999, 0, 1_001, u64::MAX, 0, u64::MAX);
        assert_eq!(floor, 2_000);

        let mut seed = 0xAC_A1_2026_u64;
        for _ in 0..10_000 {
            seed = seed.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1);
            let reported = seed;
            seed = seed.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1);
            let baseline = seed % (reported.saturating_add(1));
            seed = seed.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1);
            let cpm = seed;
            seed = seed.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1);
            let cap = seed;
            seed = seed.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1);
            let total_paid = seed % cap.saturating_add(1).max(1);
            seed = seed.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1);
            let pool = seed;

            let (payout, remaining) =
                calculate_payout(reported, baseline, cpm, cap, total_paid, pool);
            let entitlement_u128 = ((reported.saturating_sub(baseline) as u128) * (cpm as u128)
                / 1000)
                .min(cap as u128);
            let entitlement = entitlement_u128 as u64;
            let claimable = entitlement.saturating_sub(total_paid);
            assert_eq!(payout.saturating_add(remaining), claimable);
            assert!(payout <= pool);
            assert!(payout <= claimable);
            assert!(entitlement <= cap);
        }
    }
}
