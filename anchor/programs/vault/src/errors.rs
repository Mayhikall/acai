use anchor_lang::prelude::*;

#[error_code]
pub enum ProgramError {
    #[msg("Signer is not creator")]
    NotCreator,
    #[msg("Signer is not clipper")]
    NotClipper,
    #[msg("Signer is not authorized oracle")]
    NotOracle,
    #[msg("Signer is not admin")]
    NotAdmin,
    #[msg("Signer is not program upgrade authority")]
    NotUpgradeAuthority,

    #[msg("Config account already initialized")]
    ConfigAlreadyInitialized,
    #[msg("Invalid parameters provided")]
    InvalidParams,
    #[msg("Invalid token mint")]
    InvalidMint,

    #[msg("Campaign is not funded")]
    CampaignNotFunded,
    #[msg("Campaign is not active")]
    CampaignNotActive,
    #[msg("Campaign is already closed")]
    CampaignClosed,
    #[msg("Outside allowed campaign period")]
    OutsideCampaignPeriod,
    #[msg("Creator cannot submit to own campaign")]
    SelfSubmission,
    #[msg("Active video quota reached for clipper")]
    QuotaExceeded,
    #[msg("Total submission quota reached for clipper")]
    TotalQuotaExceeded,

    #[msg("Submission status is invalid for this operation")]
    InvalidStatus,
    #[msg("Review deadline has already passed")]
    ReviewDeadlinePassed,
    #[msg("Review deadline has not been reached yet")]
    ReviewDeadlineNotReached,
    #[msg("Appeal window has closed")]
    AppealWindowClosed,
    #[msg("Submission has already been appealed")]
    AlreadyAppealed,

    #[msg("Baseline views have not been established yet")]
    BaselineMissing,
    #[msg("Report timestamp must be strictly newer than previous report")]
    ReportReplay,
    #[msg("Reported view count cannot decrease")]
    ViewsDecreased,
    #[msg("Report timestamp is in the future")]
    ReportFromFuture,
    #[msg("Report timestamp is before submission timestamp")]
    ReportBeforeSubmission,
    #[msg("Non-final report cannot be dated after campaign end time")]
    ReportAfterEnd,

    #[msg("Final report must be within final snapshot tolerance window")]
    FinalOutsideWindow,
    #[msg("Final report has already been accepted")]
    FinalAlreadyReceived,
    #[msg("Cannot submit final report before baseline views are established")]
    FinalBeforeBaseline,

    #[msg("Report reporter does not match current configured oracle")]
    InvalidReporter,
    #[msg("Report is too old; fresh oracle report required")]
    ReportTooOld,
    #[msg("Final report is pending from oracle")]
    FinalReportPending,

    #[msg("Settlement period has already ended")]
    SettlementOver,
    #[msg("Settlement period has not ended yet")]
    SettlementNotOver,

    #[msg("Nothing to claim")]
    NothingToClaim,
    #[msg("Campaign pool is empty")]
    PoolEmpty,
    #[msg("Math overflow encountered")]
    MathOverflow,
}
