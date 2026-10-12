use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

#[cfg(test)]
mod runtime_tests;
#[cfg(test)]
mod tests;

declare_id!("CceJJ1LXS13HDMJRVdhw8GEw42r3roULbX5kCABG6K8E");

#[program]
pub mod vault {
    use super::*;

    // Config governance
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        admin: Pubkey,
        oracle: Pubkey,
    ) -> Result<()> {
        instructions::handle_initialize_config(ctx, admin, oracle)
    }

    pub fn update_oracle(ctx: Context<UpdateOracle>, new_oracle: Pubkey) -> Result<()> {
        instructions::handle_update_oracle(ctx, new_oracle)
    }

    pub fn propose_admin(ctx: Context<ProposeAdmin>, new_admin: Pubkey) -> Result<()> {
        instructions::handle_propose_admin(ctx, new_admin)
    }

    pub fn accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
        instructions::handle_accept_admin(ctx)
    }

    // Campaign lifecycle
    pub fn initialize_campaign(
        ctx: Context<InitializeCampaign>,
        params: InitializeCampaignParams,
    ) -> Result<()> {
        instructions::handle_initialize_campaign(ctx, params)
    }

    pub fn fund_campaign(ctx: Context<FundCampaign>) -> Result<()> {
        instructions::handle_fund_campaign(ctx)
    }

    pub fn top_up(ctx: Context<TopUp>, amount: u64) -> Result<()> {
        instructions::handle_top_up(ctx, amount)
    }

    pub fn close_unfunded(ctx: Context<CloseUnfunded>) -> Result<()> {
        instructions::handle_close_unfunded(ctx)
    }

    // Submission lifecycle
    pub fn register_submission(
        ctx: Context<RegisterSubmission>,
        video_id: String,
        terms_hash: [u8; 32],
    ) -> Result<()> {
        instructions::handle_register_submission(ctx, video_id, terms_hash)
    }

    pub fn accept_submission(ctx: Context<ReviewSubmission>) -> Result<()> {
        instructions::handle_accept_submission(ctx)
    }

    pub fn reject_submission(ctx: Context<ReviewSubmission>, reason_hash: [u8; 32]) -> Result<()> {
        instructions::handle_reject_submission(ctx, reason_hash)
    }

    pub fn appeal_submission(ctx: Context<AppealSubmission>) -> Result<()> {
        instructions::handle_appeal_submission(ctx)
    }

    pub fn finalize_timeout(ctx: Context<FinalizeTimeout>) -> Result<()> {
        instructions::handle_finalize_timeout(ctx)
    }

    // Oracle
    pub fn submit_oracle_report(
        ctx: Context<SubmitOracleReport>,
        view_count: u64,
        fetched_at: i64,
        is_final: bool,
    ) -> Result<()> {
        instructions::handle_submit_oracle_report(ctx, view_count, fetched_at, is_final)
    }

    // Claim, Refund, Cleanup
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::handle_claim(ctx)
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        instructions::handle_refund(ctx)
    }

    pub fn close_report(ctx: Context<CloseReport>) -> Result<()> {
        instructions::handle_close_report(ctx)
    }

    pub fn close_submission(ctx: Context<CloseSubmission>) -> Result<()> {
        instructions::handle_close_submission(ctx)
    }

    pub fn close_stats(ctx: Context<CloseStats>) -> Result<()> {
        instructions::handle_close_stats(ctx)
    }
}
