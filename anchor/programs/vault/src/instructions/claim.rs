use crate::errors::ProgramError;
use crate::events::*;
use crate::state::{
    Campaign, CampaignStatus, ClipperStats, Config, OracleReport, Submission, SubmissionStatus,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"campaign", campaign.creator.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump,
        has_one = vault @ ProgramError::InvalidParams,
        has_one = mint @ ProgramError::InvalidMint
    )]
    pub campaign: Box<Account<'info, Campaign>>,

    #[account(
        mut,
        seeds = [b"vault", campaign.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = campaign
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"submission", campaign.key().as_ref(), submission.video_id.as_bytes()],
        bump = submission.bump,
        has_one = campaign @ ProgramError::InvalidParams,
        has_one = clipper @ ProgramError::NotClipper
    )]
    pub submission: Box<Account<'info, Submission>>,

    #[account(
        seeds = [b"report", submission.key().as_ref()],
        bump,
        has_one = submission @ ProgramError::InvalidParams,
        constraint = report.campaign == campaign.key() @ ProgramError::InvalidParams
    )]
    pub report: Box<Account<'info, OracleReport>>,

    #[account(
        mut,
        constraint = clipper_token_account.owner == clipper.key() @ ProgramError::NotClipper,
        constraint = clipper_token_account.mint == mint.key() @ ProgramError::InvalidMint
    )]
    pub clipper_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub clipper: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(
        mut,
        seeds = [b"campaign", campaign.creator.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump,
        has_one = creator @ ProgramError::NotCreator,
        has_one = vault @ ProgramError::InvalidParams,
        has_one = mint @ ProgramError::InvalidMint
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        mut,
        seeds = [b"vault", campaign.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = campaign
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = creator_token_account.owner == creator.key() @ ProgramError::NotCreator,
        constraint = creator_token_account.mint == mint.key() @ ProgramError::InvalidMint
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CloseReport<'info> {
    #[account(
        seeds = [b"campaign", campaign.creator.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        mut,
        seeds = [b"report", report.submission.as_ref()],
        bump,
        has_one = campaign @ ProgramError::InvalidParams,
        close = recipient
    )]
    pub report: Account<'info, OracleReport>,

    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    /// CHECK: Recipient receiving lamports from closed report account
    #[account(
        mut,
        constraint = recipient.key() == report.reporter || recipient.key() == config.oracle @ ProgramError::NotOracle
    )]
    pub recipient: UncheckedAccount<'info>,

    #[account(
        constraint = signer.key() == report.reporter || signer.key() == config.oracle @ ProgramError::NotOracle
    )]
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseSubmission<'info> {
    #[account(
        seeds = [b"campaign", campaign.creator.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        mut,
        seeds = [b"submission", campaign.key().as_ref(), submission.video_id.as_bytes()],
        bump = submission.bump,
        has_one = campaign @ ProgramError::InvalidParams,
        has_one = clipper @ ProgramError::NotClipper,
        close = clipper
    )]
    pub submission: Account<'info, Submission>,

    #[account(mut)]
    pub clipper: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseStats<'info> {
    #[account(
        seeds = [b"campaign", campaign.creator.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        mut,
        seeds = [b"stats", campaign.key().as_ref(), clipper.key().as_ref()],
        bump,
        close = clipper
    )]
    pub stats: Account<'info, ClipperStats>,

    #[account(mut)]
    pub clipper: Signer<'info>,
}

pub fn handle_claim(ctx: Context<Claim>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let config = &ctx.accounts.config;
    let campaign = &mut ctx.accounts.campaign;
    let submission = &mut ctx.accounts.submission;
    let report = &ctx.accounts.report;

    // 1. Must be accepted
    require!(
        submission.status == SubmissionStatus::Accepted,
        ProgramError::InvalidStatus
    );

    // 2. Baseline must be present
    let baseline_views = submission
        .baseline_views
        .ok_or(ProgramError::BaselineMissing)?;

    // 3. Settlement window: now <= end_time + settlement_period
    let settlement_end = campaign
        .end_time
        .checked_add(campaign.settlement_period)
        .ok_or(ProgramError::MathOverflow)?;
    require!(now <= settlement_end, ProgramError::SettlementOver);

    // 4. Report validation (Section 7.6 & 7.7)
    require!(
        report.reporter == config.oracle,
        ProgramError::InvalidReporter
    );

    if now <= campaign.end_time {
        let max_age_allowed = now
            .checked_sub(campaign.max_report_age)
            .ok_or(ProgramError::MathOverflow)?;
        require!(
            report.fetched_at >= max_age_allowed,
            ProgramError::ReportTooOld
        );
    } else {
        // After end_time
        if !report.is_final {
            let tolerance_end = campaign
                .end_time
                .checked_add(campaign.final_snapshot_tolerance)
                .ok_or(ProgramError::MathOverflow)?;
            if now <= tolerance_end {
                return err!(ProgramError::FinalReportPending);
            }
            // Fallback non-final: allowed without max_report_age, but fetched_at must be <= end_time
            require!(
                report.fetched_at <= campaign.end_time,
                ProgramError::ReportAfterEnd
            );
        }
    }

    // 5. Payment formula (Section 8.2)
    let eligible_views = report.view_count.saturating_sub(baseline_views);
    let raw_entitlement = (eligible_views as u128)
        .checked_mul(campaign.cpm as u128)
        .ok_or(ProgramError::MathOverflow)?
        / 1000;
    let capped_entitlement = std::cmp::min(raw_entitlement, campaign.max_payout_per_video as u128);
    let entitlement = u64::try_from(capped_entitlement).map_err(|_| ProgramError::MathOverflow)?;

    let claimable = entitlement.saturating_sub(submission.total_paid);
    let remaining_pool = ctx.accounts.vault.amount;

    if claimable == 0 {
        return err!(ProgramError::NothingToClaim);
    }
    if remaining_pool == 0 {
        return err!(ProgramError::PoolEmpty);
    }

    let payout = std::cmp::min(claimable, remaining_pool);

    // 6. CPI transfer from vault to clipper
    let creator_key = campaign.creator;
    let campaign_id_bytes = campaign.campaign_id.to_le_bytes();
    let campaign_seeds: &[&[&[u8]]] = &[&[
        b"campaign",
        creator_key.as_ref(),
        &campaign_id_bytes,
        &[campaign.bump],
    ]];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.clipper_token_account.to_account_info(),
            authority: campaign.to_account_info(),
        },
        campaign_seeds,
    );
    token::transfer(transfer_ctx, payout)?;

    // 7. Update state
    submission.total_paid = submission
        .total_paid
        .checked_add(payout)
        .ok_or(ProgramError::MathOverflow)?;
    campaign.total_paid = campaign
        .total_paid
        .checked_add(payout)
        .ok_or(ProgramError::MathOverflow)?;

    let remaining_claim = claimable.saturating_sub(payout);

    emit!(Claimed {
        campaign_id: campaign.campaign_id,
        clipper: submission.clipper,
        video_id: submission.video_id.clone(),
        amount: payout,
        remaining_claim,
    });

    Ok(())
}

pub fn handle_refund(ctx: Context<Refund>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let campaign = &mut ctx.accounts.campaign;

    // 1. Settlement must be over: now > end_time + settlement_period
    let settlement_end = campaign
        .end_time
        .checked_add(campaign.settlement_period)
        .ok_or(ProgramError::MathOverflow)?;
    require!(now > settlement_end, ProgramError::SettlementNotOver);

    // 2. Campaign must not be closed already
    require!(
        campaign.status != CampaignStatus::Closed,
        ProgramError::CampaignClosed
    );

    let refund_amount = ctx.accounts.vault.amount;
    let creator_key = campaign.creator;
    let campaign_id_bytes = campaign.campaign_id.to_le_bytes();
    let campaign_seeds: &[&[&[u8]]] = &[&[
        b"campaign",
        creator_key.as_ref(),
        &campaign_id_bytes,
        &[campaign.bump],
    ]];

    // Transfer remaining pool to creator token account
    if refund_amount > 0 {
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: campaign.to_account_info(),
            },
            campaign_seeds,
        );
        token::transfer(transfer_ctx, refund_amount)?;
    }

    // Close vault token account
    let close_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.creator.to_account_info(),
            authority: campaign.to_account_info(),
        },
        campaign_seeds,
    );
    token::close_account(close_ctx)?;

    campaign.status = CampaignStatus::Closed;

    emit!(Refunded {
        campaign_id: campaign.campaign_id,
        creator: campaign.creator,
        amount: refund_amount,
    });
    emit!(CampaignClosed {
        campaign_id: campaign.campaign_id,
        creator: campaign.creator,
    });

    Ok(())
}

pub fn handle_close_report(ctx: Context<CloseReport>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let campaign = &ctx.accounts.campaign;
    let settlement_end = campaign
        .end_time
        .checked_add(campaign.settlement_period)
        .ok_or(ProgramError::MathOverflow)?;
    require!(now > settlement_end, ProgramError::SettlementNotOver);

    let signer_key = ctx.accounts.signer.key();
    let report_reporter = ctx.accounts.report.reporter;
    let current_oracle = ctx.accounts.config.oracle;
    require!(
        signer_key == report_reporter || signer_key == current_oracle,
        ProgramError::NotOracle
    );

    Ok(())
}

pub fn handle_close_submission(ctx: Context<CloseSubmission>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let campaign = &ctx.accounts.campaign;
    let settlement_end = campaign
        .end_time
        .checked_add(campaign.settlement_period)
        .ok_or(ProgramError::MathOverflow)?;
    require!(now > settlement_end, ProgramError::SettlementNotOver);

    Ok(())
}

pub fn handle_close_stats(ctx: Context<CloseStats>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let campaign = &ctx.accounts.campaign;
    let settlement_end = campaign
        .end_time
        .checked_add(campaign.settlement_period)
        .ok_or(ProgramError::MathOverflow)?;
    require!(now > settlement_end, ProgramError::SettlementNotOver);

    Ok(())
}
