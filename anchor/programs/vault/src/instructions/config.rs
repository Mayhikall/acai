use crate::errors::ProgramError;
use crate::events::*;
use crate::state::Config;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = payer,
        space = Config::LEN,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub admin: Signer<'info>,

    pub upgrade_authority: Signer<'info>,

    #[account(
        constraint = program.programdata_address()? == Some(program_data.key()) @ ProgramError::NotUpgradeAuthority,
        constraint = program_data.upgrade_authority_address == Some(upgrade_authority.key()) @ ProgramError::NotUpgradeAuthority
    )]
    pub program_data: Account<'info, ProgramData>,

    pub program: Program<'info, crate::program::Vault>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateOracle<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin @ ProgramError::NotAdmin
    )]
    pub config: Account<'info, Config>,

    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct ProposeAdmin<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin @ ProgramError::NotAdmin
    )]
    pub config: Account<'info, Config>,

    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct AcceptAdmin<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        constraint = config.pending_admin == Some(new_admin.key()) @ ProgramError::NotAdmin
    )]
    pub config: Account<'info, Config>,

    pub new_admin: Signer<'info>,
}

pub fn handle_initialize_config(
    ctx: Context<InitializeConfig>,
    admin: Pubkey,
    oracle: Pubkey,
) -> Result<()> {
    require_keys_eq!(ctx.accounts.admin.key(), admin, ProgramError::NotAdmin);
    let config = &mut ctx.accounts.config;
    config.admin = admin;
    config.pending_admin = None;
    config.oracle = oracle;
    config.bump = ctx.bumps.config;

    Ok(())
}

pub fn handle_update_oracle(ctx: Context<UpdateOracle>, new_oracle: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let old_oracle = config.oracle;
    config.oracle = new_oracle;

    emit!(OracleUpdated {
        old_oracle,
        new_oracle,
    });

    Ok(())
}

pub fn handle_propose_admin(ctx: Context<ProposeAdmin>, new_admin: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.pending_admin = Some(new_admin);

    emit!(AdminProposed {
        current_admin: config.admin,
        pending_admin: new_admin,
    });

    Ok(())
}

pub fn handle_accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let old_admin = config.admin;
    let new_admin = ctx.accounts.new_admin.key();

    config.admin = new_admin;
    config.pending_admin = None;

    emit!(AdminTransferred {
        old_admin,
        new_admin,
    });

    Ok(())
}
