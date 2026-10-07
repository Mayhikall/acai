use crate::errors::ProgramError;
use crate::events::*;
use crate::state::{Campaign, CampaignStatus, ClipperStats, Submission, SubmissionStatus};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(video_id: String)]
pub struct RegisterSubmission<'info> {
    #[account(
        mut,
        seeds = [b"campaign", campaign.creator.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump,
        constraint = campaign.status == CampaignStatus::Funded @ ProgramError::CampaignNotActive
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        init,
        payer = clipper,
        space = Submission::LEN,
        seeds = [b"submission", campaign.key().as_ref(), video_id.as_bytes()],
        bump
    )]
    pub submission: Account<'info, Submission>,

    #[account(
        init_if_needed,
        payer = clipper,
        space = ClipperStats::LEN,
        seeds = [b"stats", campaign.key().as_ref(), clipper.key().as_ref()],
        bump
    )]
    pub stats: Account<'info, ClipperStats>,

    #[account(mut)]
    pub clipper: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReviewSubmission<'info> {
    #[account(
        seeds = [b"campaign", campaign.creator.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump,
        has_one = creator @ ProgramError::NotCreator
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        mut,
        seeds = [b"submission", campaign.key().as_ref(), submission.video_id.as_bytes()],
        bump = submission.bump,
        has_one = campaign @ ProgramError::InvalidParams
    )]
    pub submission: Account<'info, Submission>,

    #[account(
        mut,
        seeds = [b"stats", campaign.key().as_ref(), submission.clipper.as_ref()],
        bump
    )]
    pub stats: Account<'info, ClipperStats>,

    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct AppealSubmission<'info> {
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
        has_one = clipper @ ProgramError::NotClipper
    )]
    pub submission: Account<'info, Submission>,

    #[account(
        mut,
        seeds = [b"stats", campaign.key().as_ref(), clipper.key().as_ref()],
        bump
    )]
    pub stats: Account<'info, ClipperStats>,

    pub clipper: Signer<'info>,
}

#[derive(Accounts)]
pub struct FinalizeTimeout<'info> {
    #[account(
        seeds = [b"campaign", campaign.creator.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        mut,
        seeds = [b"submission", campaign.key().as_ref(), submission.video_id.as_bytes()],
        bump = submission.bump,
        has_one = campaign @ ProgramError::InvalidParams
    )]
    pub submission: Account<'info, Submission>,
}

pub fn handle_register_submission(
    ctx: Context<RegisterSubmission>,
    video_id: String,
    terms_hash: [u8; 32],
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let campaign = &ctx.accounts.campaign;
    let clipper_key = ctx.accounts.clipper.key();

    // 1. YouTube video id validation (exact 11 characters, alphanumeric + - and _)
    require!(video_id.len() == 11, ProgramError::InvalidParams);
    for b in video_id.bytes() {
        let is_valid = b.is_ascii_alphanumeric() || b == b'-' || b == b'_';
        require!(is_valid, ProgramError::InvalidParams);
    }

    // 2. Prevent creator submitting to their own campaign
    require!(
        clipper_key != campaign.creator,
        ProgramError::SelfSubmission
    );

    // The accepted terms must match the immutable campaign commitment.
    require!(
        terms_hash == campaign.terms_hash,
        ProgramError::InvalidParams
    );

    // 3. Campaign window check
    require!(
        now >= campaign.start_time && now <= campaign.end_time,
        ProgramError::OutsideCampaignPeriod
    );

    // 4. Quota check
    let stats = &mut ctx.accounts.stats;
    require!(
        stats.active_count < campaign.max_videos_per_clipper,
        ProgramError::QuotaExceeded
    );
    let total_limit = campaign
        .max_videos_per_clipper
        .checked_mul(2)
        .ok_or(ProgramError::MathOverflow)?;
    require!(
        stats.total_submitted < total_limit,
        ProgramError::TotalQuotaExceeded
    );

    // Update stats
    stats.active_count = stats
        .active_count
        .checked_add(1)
        .ok_or(ProgramError::MathOverflow)?;
    stats.total_submitted = stats
        .total_submitted
        .checked_add(1)
        .ok_or(ProgramError::MathOverflow)?;

    let submission = &mut ctx.accounts.submission;
    submission.campaign = campaign.key();
    submission.clipper = clipper_key;
    submission.video_id = video_id.clone();
    submission.terms_hash = terms_hash;
    submission.status = SubmissionStatus::PendingReview;
    submission.submitted_at = now;
    submission.review_deadline = now
        .checked_add(campaign.review_period)
        .ok_or(ProgramError::MathOverflow)?;
    submission.rejected_at = None;
    submission.reason_hash = None;
    submission.appealed_at = None;
    submission.accepted_at = None;
    submission.baseline_views = None;
    submission.total_paid = 0;
    submission.bump = ctx.bumps.submission;

    emit!(SubmissionRegistered {
        campaign_id: campaign.campaign_id,
        clipper: clipper_key,
        video_id,
        submitted_at: now,
        review_deadline: submission.review_deadline,
    });

    Ok(())
}

pub fn handle_accept_submission(ctx: Context<ReviewSubmission>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let campaign = &ctx.accounts.campaign;
    let submission = &mut ctx.accounts.submission;

    match submission.status {
        SubmissionStatus::PendingReview => {
            require!(
                now <= submission.review_deadline,
                ProgramError::ReviewDeadlinePassed
            );
        }
        SubmissionStatus::Rejected => {
            let appealed_at = submission.appealed_at.ok_or(ProgramError::InvalidStatus)?;
            let appeal_deadline = appealed_at
                .checked_add(campaign.appeal_timeout)
                .ok_or(ProgramError::MathOverflow)?;
            require!(now <= appeal_deadline, ProgramError::ReviewDeadlinePassed);
        }
        _ => return err!(ProgramError::InvalidStatus),
    }

    submission.status = SubmissionStatus::Accepted;
    submission.accepted_at = Some(now);

    emit!(SubmissionAccepted {
        campaign_id: campaign.campaign_id,
        video_id: submission.video_id.clone(),
        clipper: submission.clipper,
        accepted_at: now,
    });

    Ok(())
}

pub fn handle_reject_submission(
    ctx: Context<ReviewSubmission>,
    reason_hash: [u8; 32],
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let campaign = &ctx.accounts.campaign;
    let submission = &mut ctx.accounts.submission;
    let stats = &mut ctx.accounts.stats;

    match submission.status {
        SubmissionStatus::PendingReview => {
            require!(
                now <= submission.review_deadline,
                ProgramError::ReviewDeadlinePassed
            );
            submission.status = SubmissionStatus::Rejected;
            submission.rejected_at = Some(now);
            submission.reason_hash = Some(reason_hash);

            // Releasing active count on initial rejection
            stats.active_count = stats.active_count.saturating_sub(1);

            emit!(SubmissionRejected {
                campaign_id: campaign.campaign_id,
                video_id: submission.video_id.clone(),
                clipper: submission.clipper,
                reason_hash,
                is_final: false,
            });
        }
        SubmissionStatus::Rejected => {
            // Final rejection during appeal
            let appealed_at = submission.appealed_at.ok_or(ProgramError::InvalidStatus)?;
            let appeal_deadline = appealed_at
                .checked_add(campaign.appeal_timeout)
                .ok_or(ProgramError::MathOverflow)?;
            require!(now <= appeal_deadline, ProgramError::ReviewDeadlinePassed);

            submission.status = SubmissionStatus::RejectedFinal;
            // Appeal added +1 active_count, so final rejection frees it again
            stats.active_count = stats.active_count.saturating_sub(1);

            emit!(SubmissionRejected {
                campaign_id: campaign.campaign_id,
                video_id: submission.video_id.clone(),
                clipper: submission.clipper,
                reason_hash,
                is_final: true,
            });
        }
        _ => return err!(ProgramError::InvalidStatus),
    }

    Ok(())
}

pub fn handle_appeal_submission(ctx: Context<AppealSubmission>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let campaign = &ctx.accounts.campaign;
    let submission = &mut ctx.accounts.submission;
    let stats = &mut ctx.accounts.stats;

    require!(
        submission.status == SubmissionStatus::Rejected,
        ProgramError::InvalidStatus
    );
    require!(
        submission.appealed_at.is_none(),
        ProgramError::AlreadyAppealed
    );

    let rejected_at = submission.rejected_at.ok_or(ProgramError::InvalidStatus)?;
    let appeal_deadline = rejected_at
        .checked_add(campaign.appeal_window)
        .ok_or(ProgramError::MathOverflow)?;
    require!(now <= appeal_deadline, ProgramError::AppealWindowClosed);

    // Active count check for appeal
    require!(
        stats.active_count < campaign.max_videos_per_clipper,
        ProgramError::QuotaExceeded
    );
    stats.active_count = stats
        .active_count
        .checked_add(1)
        .ok_or(ProgramError::MathOverflow)?;

    submission.appealed_at = Some(now);

    emit!(SubmissionAppealed {
        campaign_id: campaign.campaign_id,
        video_id: submission.video_id.clone(),
        clipper: submission.clipper,
        appealed_at: now,
    });

    Ok(())
}

pub fn handle_finalize_timeout(ctx: Context<FinalizeTimeout>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let campaign = &ctx.accounts.campaign;
    let submission = &mut ctx.accounts.submission;

    match submission.status {
        SubmissionStatus::PendingReview => {
            require!(
                now > submission.review_deadline,
                ProgramError::ReviewDeadlineNotReached
            );
        }
        SubmissionStatus::Rejected => {
            let appealed_at = submission.appealed_at.ok_or(ProgramError::InvalidStatus)?;
            let appeal_deadline = appealed_at
                .checked_add(campaign.appeal_timeout)
                .ok_or(ProgramError::MathOverflow)?;
            require!(
                now > appeal_deadline,
                ProgramError::ReviewDeadlineNotReached
            );
        }
        _ => return err!(ProgramError::InvalidStatus),
    }

    submission.status = SubmissionStatus::Accepted;
    submission.accepted_at = Some(now);

    emit!(SubmissionFinalized {
        campaign_id: campaign.campaign_id,
        video_id: submission.video_id.clone(),
        accepted_at: now,
    });

    Ok(())
}
