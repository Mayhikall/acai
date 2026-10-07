use crate::errors::ProgramError;
use crate::events::*;
use crate::state::{Campaign, Config, OracleReport, Submission, SubmissionStatus};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SubmitOracleReport<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

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

    #[account(
        init_if_needed,
        payer = oracle,
        space = OracleReport::LEN,
        seeds = [b"report", submission.key().as_ref()],
        bump
    )]
    pub report: Account<'info, OracleReport>,

    #[account(
        mut,
        constraint = oracle.key() == config.oracle @ ProgramError::NotOracle
    )]
    pub oracle: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_submit_oracle_report(
    ctx: Context<SubmitOracleReport>,
    view_count: u64,
    fetched_at: i64,
    is_final: bool,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let _config = &ctx.accounts.config;
    let campaign = &ctx.accounts.campaign;
    let submission = &mut ctx.accounts.submission;
    let report = &mut ctx.accounts.report;
    let oracle_key = ctx.accounts.oracle.key();

    // 1. Signer check: already verified via constraint oracle.key() == config.oracle @ NotOracle

    // 2. Submission status cannot be RejectedFinal
    require!(
        submission.status != SubmissionStatus::RejectedFinal,
        ProgramError::InvalidStatus
    );

    // 3. fetched_at > now + clock_skew_tolerance => ReportFromFuture
    let max_future_allowed = now
        .checked_add(campaign.clock_skew_tolerance)
        .ok_or(ProgramError::MathOverflow)?;
    require!(
        fetched_at <= max_future_allowed,
        ProgramError::ReportFromFuture
    );

    // 6. fetched_at < submitted_at - clock_skew_tolerance => ReportBeforeSubmission
    let min_past_allowed = submission
        .submitted_at
        .checked_sub(campaign.clock_skew_tolerance)
        .ok_or(ProgramError::MathOverflow)?;
    require!(
        fetched_at >= min_past_allowed,
        ProgramError::ReportBeforeSubmission
    );

    // Comparison against existing report if reporter matches current oracle
    let has_matching_prior_report = report.reporter == oracle_key && report.fetched_at > 0;

    if has_matching_prior_report {
        // 4. fetched_at <= report.fetched_at => ReportReplay
        require!(fetched_at > report.fetched_at, ProgramError::ReportReplay);

        // 5. view_count < report.view_count => ViewsDecreased
        require!(
            view_count >= report.view_count,
            ProgramError::ViewsDecreased
        );

        // 9. report pembanding sudah berstatus final => FinalAlreadyReceived
        require!(!report.is_final, ProgramError::FinalAlreadyReceived);
    }

    let is_first_report_for_submission = submission.baseline_views.is_none();

    if !is_final {
        // 7. Report non-final cannot have fetched_at > end_time, EXCEPT baseline
        if !is_first_report_for_submission {
            require!(
                fetched_at <= campaign.end_time,
                ProgramError::ReportAfterEnd
            );
        } else {
            // Baseline exception (Section 7.4): allowed up to now, provided now <= end_time + final_snapshot_tolerance
            let baseline_cutoff = campaign
                .end_time
                .checked_add(campaign.final_snapshot_tolerance)
                .ok_or(ProgramError::MathOverflow)?;
            require!(now <= baseline_cutoff, ProgramError::ReportAfterEnd);
        }
    } else {
        // Final report validations:
        // 10. Final report before baseline established => FinalBeforeBaseline
        require!(
            !is_first_report_for_submission,
            ProgramError::FinalBeforeBaseline
        );

        // 8. Final report window validation:
        // Window: [end_time - tolerance, end_time + tolerance]
        let window_start = campaign
            .end_time
            .checked_sub(campaign.final_snapshot_tolerance)
            .ok_or(ProgramError::MathOverflow)?;
        let window_end = campaign
            .end_time
            .checked_add(campaign.final_snapshot_tolerance)
            .ok_or(ProgramError::MathOverflow)?;
        require!(
            fetched_at >= window_start && fetched_at <= window_end,
            ProgramError::FinalOutsideWindow
        );

        // Sent when now > end_time
        require!(now > campaign.end_time, ProgramError::FinalOutsideWindow);

        // Not after settlement period
        let settlement_end = campaign
            .end_time
            .checked_add(campaign.settlement_period)
            .ok_or(ProgramError::MathOverflow)?;
        require!(now <= settlement_end, ProgramError::SettlementOver);
    }

    // Set baseline views on first report
    let mut is_baseline = false;
    if is_first_report_for_submission {
        submission.baseline_views = Some(view_count);
        is_baseline = true;
    }

    // Update OracleReport account
    let next_seq = report.report_seq.checked_add(1).unwrap_or(1);
    report.campaign = campaign.key();
    report.submission = submission.key();
    report.view_count = view_count;
    report.fetched_at = fetched_at;
    report.report_seq = next_seq;
    report.is_final = is_final;
    report.reporter = oracle_key;

    emit!(OracleReportSubmitted {
        submission: submission.key(),
        view_count,
        fetched_at,
        report_seq: next_seq,
        is_final,
        is_baseline,
        reporter: oracle_key,
    });

    Ok(())
}
