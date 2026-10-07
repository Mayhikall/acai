use crate::errors::ProgramError;
use crate::events::*;
use crate::state::{Campaign, CampaignStatus};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeCampaignParams {
    pub campaign_id: u64,
    pub terms_hash: [u8; 32],
    pub cpm: u64,
    pub max_payout_per_video: u64,
    pub budget: u64,
    pub start_time: i64,
    pub end_time: i64,

    pub review_period: i64,
    pub appeal_window: i64,
    pub appeal_timeout: i64,
    pub settlement_period: i64,
    pub max_report_age: i64,
    pub final_snapshot_tolerance: i64,
    pub clock_skew_tolerance: i64,
    pub max_videos_per_clipper: u16,
}

#[derive(Accounts)]
#[instruction(params: InitializeCampaignParams)]
pub struct InitializeCampaign<'info> {
    #[account(
        init,
        payer = creator,
        space = Campaign::LEN,
        seeds = [b"campaign", creator.key().as_ref(), &params.campaign_id.to_le_bytes()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundCampaign<'info> {
    #[account(
        mut,
        seeds = [b"campaign", campaign.creator.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump,
        has_one = creator @ ProgramError::NotCreator,
        has_one = mint @ ProgramError::InvalidMint
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        init,
        payer = creator,
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
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct TopUp<'info> {
    #[account(
        mut,
        seeds = [b"campaign", campaign.creator.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump,
        has_one = creator @ ProgramError::NotCreator,
        has_one = vault @ ProgramError::InvalidParams,
        has_one = mint @ ProgramError::InvalidMint
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(mut)]
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
pub struct CloseUnfunded<'info> {
    #[account(
        mut,
        seeds = [b"campaign", campaign.creator.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump,
        has_one = creator @ ProgramError::NotCreator,
        close = creator
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(mut)]
    pub creator: Signer<'info>,
}

pub fn handle_initialize_campaign(
    ctx: Context<InitializeCampaign>,
    params: InitializeCampaignParams,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    // Campaign parameter validation constraints
    // CPM and payout amounts are expressed in the mint base units.
    require!(ctx.accounts.mint.decimals == 6, ProgramError::InvalidMint);
    require!(params.cpm > 0, ProgramError::InvalidParams);
    require!(params.max_payout_per_video > 0, ProgramError::InvalidParams);
    require!(params.budget > 0, ProgramError::InvalidParams);
    require!(now < params.end_time, ProgramError::InvalidParams);
    require!(
        params.start_time < params.end_time,
        ProgramError::InvalidParams
    );

    require!(params.review_period > 0, ProgramError::InvalidParams);
    require!(params.appeal_window > 0, ProgramError::InvalidParams);
    require!(params.appeal_timeout > 0, ProgramError::InvalidParams);
    require!(params.settlement_period > 0, ProgramError::InvalidParams);
    require!(params.max_report_age > 0, ProgramError::InvalidParams);
    require!(
        params.final_snapshot_tolerance > 0,
        ProgramError::InvalidParams
    );
    require!(
        params.max_videos_per_clipper > 0,
        ProgramError::InvalidParams
    );

    require!(
        params.settlement_period > 2 * params.final_snapshot_tolerance,
        ProgramError::InvalidParams
    );
    require!(
        params.clock_skew_tolerance > 0
            && params.clock_skew_tolerance < params.final_snapshot_tolerance,
        ProgramError::InvalidParams
    );

    let campaign_key = ctx.accounts.campaign.key();
    let (vault_pda, _) =
        Pubkey::find_program_address(&[b"vault", campaign_key.as_ref()], ctx.program_id);

    let campaign = &mut ctx.accounts.campaign;
    campaign.campaign_id = params.campaign_id;
    campaign.creator = ctx.accounts.creator.key();
    campaign.mint = ctx.accounts.mint.key();
    campaign.vault = vault_pda;
    campaign.terms_hash = params.terms_hash;
    campaign.cpm = params.cpm;
    campaign.max_payout_per_video = params.max_payout_per_video;
    campaign.budget = params.budget;
    campaign.total_funded = 0;
    campaign.total_paid = 0;
    campaign.start_time = params.start_time;
    campaign.end_time = params.end_time;

    campaign.review_period = params.review_period;
    campaign.appeal_window = params.appeal_window;
    campaign.appeal_timeout = params.appeal_timeout;
    campaign.settlement_period = params.settlement_period;
    campaign.max_report_age = params.max_report_age;
    campaign.final_snapshot_tolerance = params.final_snapshot_tolerance;
    campaign.clock_skew_tolerance = params.clock_skew_tolerance;
    campaign.max_videos_per_clipper = params.max_videos_per_clipper;

    campaign.status = CampaignStatus::PendingFunding;
    campaign.bump = ctx.bumps.campaign;

    emit!(CampaignInitialized {
        campaign_id: params.campaign_id,
        creator: ctx.accounts.creator.key(),
        budget: params.budget,
        cpm: params.cpm,
        max_payout_per_video: params.max_payout_per_video,
        start_time: params.start_time,
        end_time: params.end_time,
    });

    Ok(())
}

pub fn handle_fund_campaign(ctx: Context<FundCampaign>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let campaign = &mut ctx.accounts.campaign;

    require!(
        campaign.status == CampaignStatus::PendingFunding,
        ProgramError::InvalidStatus
    );
    require!(now < campaign.end_time, ProgramError::OutsideCampaignPeriod);

    // Transfer exact budget from creator token account to vault
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.key(),
        Transfer {
            from: ctx.accounts.creator_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.creator.to_account_info(),
        },
    );
    token::transfer(transfer_ctx, campaign.budget)?;

    campaign.status = CampaignStatus::Funded;
    campaign.total_funded = campaign.budget;
    campaign.vault = ctx.accounts.vault.key();

    emit!(CampaignFunded {
        campaign_id: campaign.campaign_id,
        creator: campaign.creator,
        amount: campaign.budget,
    });

    Ok(())
}

pub fn handle_top_up(ctx: Context<TopUp>, amount: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let campaign = &mut ctx.accounts.campaign;

    require!(
        campaign.status == CampaignStatus::Funded,
        ProgramError::CampaignNotActive
    );
    require!(
        now <= campaign.end_time,
        ProgramError::OutsideCampaignPeriod
    );
    require!(amount > 0, ProgramError::InvalidParams);

    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.key(),
        Transfer {
            from: ctx.accounts.creator_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.creator.to_account_info(),
        },
    );
    token::transfer(transfer_ctx, amount)?;

    campaign.total_funded = campaign
        .total_funded
        .checked_add(amount)
        .ok_or(ProgramError::MathOverflow)?;

    emit!(CampaignToppedUp {
        campaign_id: campaign.campaign_id,
        creator: campaign.creator,
        amount,
        total_funded: campaign.total_funded,
    });

    Ok(())
}

pub fn handle_close_unfunded(ctx: Context<CloseUnfunded>) -> Result<()> {
    let campaign = &ctx.accounts.campaign;
    require!(
        campaign.status == CampaignStatus::PendingFunding,
        ProgramError::InvalidStatus
    );
    Ok(())
}
