use crate::{
    state::{Campaign, ClipperStats, Config, OracleReport, Submission, SubmissionStatus},
    ID as PROGRAM_ID,
};
use anchor_lang::{
    prelude::Pubkey, AccountDeserialize, AccountSerialize, InstructionData, ToAccountMetas,
};
use litesvm::{types::TransactionResult, LiteSVM};
use litesvm_token::{
    get_spl_account, spl_token::state::Account as TokenAccount,
    CreateAccount as CreateTokenAccount, CreateMint, MintTo,
};
use solana_sdk::{
    account::Account,
    clock::Clock,
    instruction::Instruction,
    signature::{Keypair, Signer},
    transaction::Transaction,
};
use std::path::PathBuf;

const TERMS_HASH: [u8; 32] = [9; 32];
const VIDEO_A: &str = "VideoId0001";
const VIDEO_B: &str = "VideoId0002";
const VIDEO_C: &str = "VideoId0003";

fn program_path() -> PathBuf {
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.push("../../target/deploy/vault.so");
    assert!(
        path.exists(),
        "build the SBF artifact first with `anchor build --ignore-keys`"
    );
    path
}

fn new_svm() -> LiteSVM {
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(PROGRAM_ID, program_path())
        .unwrap();
    svm
}

fn send(
    svm: &mut LiteSVM,
    payer: &Keypair,
    signers: &[&Keypair],
    instruction: Instruction,
) -> TransactionResult {
    svm.expire_blockhash();
    let transaction = Transaction::new_signed_with_payer(
        &[instruction],
        Some(&payer.pubkey()),
        signers,
        svm.latest_blockhash(),
    );
    svm.send_transaction(transaction)
}

fn set_time(svm: &mut LiteSVM, timestamp: i64) {
    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp = timestamp;
    svm.set_sysvar(&clock);
    svm.expire_blockhash();
}

fn read_anchor<T: AccountDeserialize>(svm: &LiteSVM, address: &Pubkey) -> T {
    let account = svm.get_account(address).unwrap();
    T::try_deserialize(&mut account.data.as_slice()).unwrap()
}

fn put_config(svm: &mut LiteSVM, admin: Pubkey, oracle: Pubkey) -> Pubkey {
    let (config_address, bump) = Pubkey::find_program_address(&[b"config"], &PROGRAM_ID);
    let config = Config {
        admin,
        pending_admin: None,
        oracle,
        bump,
    };
    let mut data = Vec::with_capacity(Config::LEN);
    config.try_serialize(&mut data).unwrap();
    data.resize(Config::LEN, 0);
    svm.set_account(
        config_address,
        Account {
            lamports: svm.minimum_balance_for_rent_exemption(Config::LEN),
            data,
            owner: PROGRAM_ID,
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();
    config_address
}

struct Harness {
    svm: LiteSVM,
    creator: Keypair,
    clipper: Keypair,
    oracle: Keypair,
    new_oracle: Keypair,
    admin: Keypair,
    mint: Pubkey,
    creator_token: Pubkey,
    clipper_token: Pubkey,
    config: Pubkey,
    campaign: Pubkey,
    vault: Pubkey,
    start: i64,
    end: i64,
    settlement_end: i64,
}

impl Harness {
    fn new(budget: u64) -> Self {
        let mut svm = new_svm();
        let creator = Keypair::new();
        let clipper = Keypair::new();
        let oracle = Keypair::new();
        let new_oracle = Keypair::new();
        let admin = Keypair::new();
        for signer in [&creator, &clipper, &oracle, &new_oracle, &admin] {
            svm.airdrop(&signer.pubkey(), 10_000_000_000).unwrap();
        }
        set_time(&mut svm, 1_800_000_000);

        let mint = CreateMint::new(&mut svm, &creator)
            .decimals(6)
            .send()
            .unwrap();
        let creator_token = CreateTokenAccount::new(&mut svm, &creator, &mint)
            .owner(&creator.pubkey())
            .send()
            .unwrap();
        let clipper_token = CreateTokenAccount::new(&mut svm, &clipper, &mint)
            .owner(&clipper.pubkey())
            .send()
            .unwrap();
        MintTo::new(
            &mut svm,
            &creator,
            &mint,
            &creator_token,
            budget + 100_000_000,
        )
        .send()
        .unwrap();

        let now = svm.get_sysvar::<Clock>().unix_timestamp;
        let start = now - 1;
        let end = now + 100;
        let settlement_end = end + 180;
        let campaign_id = 7_u64;
        let (campaign, _) = Pubkey::find_program_address(
            &[
                b"campaign",
                creator.pubkey().as_ref(),
                &campaign_id.to_le_bytes(),
            ],
            &PROGRAM_ID,
        );
        let (vault, _) = Pubkey::find_program_address(&[b"vault", campaign.as_ref()], &PROGRAM_ID);
        let initialize = Instruction {
            program_id: PROGRAM_ID,
            accounts: crate::accounts::InitializeCampaign {
                campaign,
                mint,
                creator: creator.pubkey(),
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: crate::instruction::InitializeCampaign {
                params: crate::instructions::InitializeCampaignParams {
                    campaign_id,
                    terms_hash: TERMS_HASH,
                    cpm: 2_000_000,
                    max_payout_per_video: 50_000_000,
                    budget,
                    start_time: start,
                    end_time: end,
                    review_period: 20,
                    appeal_window: 20,
                    appeal_timeout: 20,
                    settlement_period: 180,
                    max_report_age: 30,
                    final_snapshot_tolerance: 60,
                    clock_skew_tolerance: 10,
                    max_videos_per_clipper: 5,
                },
            }
            .data(),
        };
        send(&mut svm, &creator, &[&creator], initialize).unwrap();

        let fund = Instruction {
            program_id: PROGRAM_ID,
            accounts: crate::accounts::FundCampaign {
                campaign,
                vault,
                creator_token_account: creator_token,
                mint,
                creator: creator.pubkey(),
                token_program: anchor_spl::token::ID,
                system_program: anchor_lang::system_program::ID,
                rent: solana_sdk::sysvar::rent::ID,
            }
            .to_account_metas(None),
            data: crate::instruction::FundCampaign {}.data(),
        };
        send(&mut svm, &creator, &[&creator], fund).unwrap();
        let config = put_config(&mut svm, admin.pubkey(), oracle.pubkey());

        Self {
            svm,
            creator,
            clipper,
            oracle,
            new_oracle,
            admin,
            mint,
            creator_token,
            clipper_token,
            config,
            campaign,
            vault,
            start,
            end,
            settlement_end,
        }
    }

    fn submission_addresses(&self, video_id: &str) -> (Pubkey, Pubkey, Pubkey) {
        let (submission, _) = Pubkey::find_program_address(
            &[b"submission", self.campaign.as_ref(), video_id.as_bytes()],
            &PROGRAM_ID,
        );
        let (stats, _) = Pubkey::find_program_address(
            &[
                b"stats",
                self.campaign.as_ref(),
                self.clipper.pubkey().as_ref(),
            ],
            &PROGRAM_ID,
        );
        let (report, _) =
            Pubkey::find_program_address(&[b"report", submission.as_ref()], &PROGRAM_ID);
        (submission, stats, report)
    }

    fn register(&mut self, video_id: &str, terms_hash: [u8; 32]) -> TransactionResult {
        let (submission, stats, _) = self.submission_addresses(video_id);
        let instruction = Instruction {
            program_id: PROGRAM_ID,
            accounts: crate::accounts::RegisterSubmission {
                campaign: self.campaign,
                submission,
                stats,
                clipper: self.clipper.pubkey(),
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: crate::instruction::RegisterSubmission {
                video_id: video_id.to_owned(),
                terms_hash,
            }
            .data(),
        };
        send(&mut self.svm, &self.clipper, &[&self.clipper], instruction)
    }

    fn review(&mut self, video_id: &str, reject: bool) -> TransactionResult {
        let (submission, stats, _) = self.submission_addresses(video_id);
        let accounts = crate::accounts::ReviewSubmission {
            campaign: self.campaign,
            submission,
            stats,
            creator: self.creator.pubkey(),
        }
        .to_account_metas(None);
        let data = if reject {
            crate::instruction::RejectSubmission {
                reason_hash: [3; 32],
            }
            .data()
        } else {
            crate::instruction::AcceptSubmission {}.data()
        };
        send(
            &mut self.svm,
            &self.creator,
            &[&self.creator],
            Instruction {
                program_id: PROGRAM_ID,
                accounts,
                data,
            },
        )
    }

    fn appeal(&mut self, video_id: &str) -> TransactionResult {
        let (submission, stats, _) = self.submission_addresses(video_id);
        let instruction = Instruction {
            program_id: PROGRAM_ID,
            accounts: crate::accounts::AppealSubmission {
                campaign: self.campaign,
                submission,
                stats,
                clipper: self.clipper.pubkey(),
            }
            .to_account_metas(None),
            data: crate::instruction::AppealSubmission {}.data(),
        };
        send(&mut self.svm, &self.clipper, &[&self.clipper], instruction)
    }

    fn finalize(&mut self, video_id: &str) -> TransactionResult {
        let (submission, _, _) = self.submission_addresses(video_id);
        let instruction = Instruction {
            program_id: PROGRAM_ID,
            accounts: crate::accounts::FinalizeTimeout {
                campaign: self.campaign,
                submission,
            }
            .to_account_metas(None),
            data: crate::instruction::FinalizeTimeout {}.data(),
        };
        send(&mut self.svm, &self.clipper, &[&self.clipper], instruction)
    }

    fn report_with(
        &mut self,
        video_id: &str,
        view_count: u64,
        fetched_at: i64,
        is_final: bool,
        use_new_oracle: bool,
    ) -> TransactionResult {
        let (submission, _, report) = self.submission_addresses(video_id);
        let oracle = if use_new_oracle {
            &self.new_oracle
        } else {
            &self.oracle
        };
        let instruction = Instruction {
            program_id: PROGRAM_ID,
            accounts: crate::accounts::SubmitOracleReport {
                config: self.config,
                campaign: self.campaign,
                submission,
                report,
                oracle: oracle.pubkey(),
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: crate::instruction::SubmitOracleReport {
                view_count,
                fetched_at,
                is_final,
            }
            .data(),
        };
        send(&mut self.svm, oracle, &[oracle], instruction)
    }

    fn rotate_oracle(&mut self) -> TransactionResult {
        let instruction = Instruction {
            program_id: PROGRAM_ID,
            accounts: crate::accounts::UpdateOracle {
                config: self.config,
                admin: self.admin.pubkey(),
            }
            .to_account_metas(None),
            data: crate::instruction::UpdateOracle {
                new_oracle: self.new_oracle.pubkey(),
            }
            .data(),
        };
        send(&mut self.svm, &self.admin, &[&self.admin], instruction)
    }

    fn claim(&mut self, video_id: &str) -> TransactionResult {
        let (submission, _, report) = self.submission_addresses(video_id);
        let instruction = Instruction {
            program_id: PROGRAM_ID,
            accounts: crate::accounts::Claim {
                config: self.config,
                campaign: self.campaign,
                vault: self.vault,
                submission,
                report,
                clipper_token_account: self.clipper_token,
                mint: self.mint,
                clipper: self.clipper.pubkey(),
                token_program: anchor_spl::token::ID,
            }
            .to_account_metas(None),
            data: crate::instruction::Claim {}.data(),
        };
        send(&mut self.svm, &self.clipper, &[&self.clipper], instruction)
    }

    fn top_up(&mut self, amount: u64) -> TransactionResult {
        let instruction = Instruction {
            program_id: PROGRAM_ID,
            accounts: crate::accounts::TopUp {
                campaign: self.campaign,
                vault: self.vault,
                creator_token_account: self.creator_token,
                mint: self.mint,
                creator: self.creator.pubkey(),
                token_program: anchor_spl::token::ID,
            }
            .to_account_metas(None),
            data: crate::instruction::TopUp { amount }.data(),
        };
        send(&mut self.svm, &self.creator, &[&self.creator], instruction)
    }

    fn refund(&mut self) -> TransactionResult {
        let instruction = Instruction {
            program_id: PROGRAM_ID,
            accounts: crate::accounts::Refund {
                campaign: self.campaign,
                vault: self.vault,
                creator_token_account: self.creator_token,
                mint: self.mint,
                creator: self.creator.pubkey(),
                token_program: anchor_spl::token::ID,
            }
            .to_account_metas(None),
            data: crate::instruction::Refund {}.data(),
        };
        send(&mut self.svm, &self.creator, &[&self.creator], instruction)
    }
}

#[test]
fn runtime_reject_appeal_final_reject_and_timeout_boundaries() {
    let mut harness = Harness::new(60_000_000);
    assert!(harness.register(VIDEO_A, [0; 32]).is_err());
    assert!(harness
        .svm
        .get_account(&harness.submission_addresses(VIDEO_A).0)
        .is_none());

    harness.register(VIDEO_A, TERMS_HASH).unwrap();
    harness.review(VIDEO_A, true).unwrap();
    let (_, stats_address, _) = harness.submission_addresses(VIDEO_A);
    let stats: ClipperStats = read_anchor(&harness.svm, &stats_address);
    assert_eq!(stats.active_count, 0);

    harness.appeal(VIDEO_A).unwrap();
    let stats: ClipperStats = read_anchor(&harness.svm, &stats_address);
    assert_eq!(stats.active_count, 1);
    harness.review(VIDEO_A, true).unwrap();
    let submission: Submission =
        read_anchor(&harness.svm, &harness.submission_addresses(VIDEO_A).0);
    assert_eq!(submission.status, SubmissionStatus::RejectedFinal);
    let stats: ClipperStats = read_anchor(&harness.svm, &stats_address);
    assert_eq!(stats.active_count, 0);

    harness.register(VIDEO_B, TERMS_HASH).unwrap();
    let submission_address = harness.submission_addresses(VIDEO_B).0;
    let submission: Submission = read_anchor(&harness.svm, &submission_address);
    set_time(&mut harness.svm, submission.review_deadline);
    assert!(harness.finalize(VIDEO_B).is_err());
    set_time(&mut harness.svm, submission.review_deadline + 1);
    harness.finalize(VIDEO_B).unwrap();
    let submission: Submission = read_anchor(&harness.svm, &submission_address);
    assert_eq!(submission.status, SubmissionStatus::Accepted);
}

#[test]
fn runtime_oracle_replay_decrease_final_and_rotation() {
    let mut harness = Harness::new(60_000_000);
    harness.register(VIDEO_A, TERMS_HASH).unwrap();
    let submitted_at =
        read_anchor::<Submission>(&harness.svm, &harness.submission_addresses(VIDEO_A).0)
            .submitted_at;

    harness
        .report_with(VIDEO_A, 1_000, submitted_at, false, false)
        .unwrap();
    assert!(harness
        .report_with(VIDEO_A, 1_100, submitted_at, false, false)
        .is_err());
    assert!(harness
        .report_with(VIDEO_A, 900, submitted_at + 1, false, false)
        .is_err());
    harness
        .report_with(VIDEO_A, 2_000, submitted_at + 1, false, false)
        .unwrap();

    set_time(&mut harness.svm, harness.end + 1);
    harness
        .report_with(VIDEO_A, 2_500, harness.end, true, false)
        .unwrap();
    assert!(harness
        .report_with(VIDEO_A, 2_600, harness.end + 1, true, false)
        .is_err());

    harness.rotate_oracle().unwrap();
    assert!(harness
        .report_with(VIDEO_A, 2_600, harness.end + 1, true, false)
        .is_err());
    harness
        .report_with(VIDEO_A, 2_400, harness.end, true, true)
        .unwrap();
    let report: OracleReport = read_anchor(&harness.svm, &harness.submission_addresses(VIDEO_A).2);
    assert_eq!(report.reporter, harness.new_oracle.pubkey());
    assert_eq!(report.view_count, 2_400);
    assert_eq!(report.report_seq, 4);
    assert!(report.is_final);
    assert!(harness
        .report_with(VIDEO_A, 2_500, harness.end + 1, true, true)
        .is_err());
}

#[test]
fn runtime_partial_claim_top_up_refund_boundary_and_cleanup() {
    let mut harness = Harness::new(20_000_000);
    harness.register(VIDEO_A, TERMS_HASH).unwrap();
    let (submission_address, stats, report) = harness.submission_addresses(VIDEO_A);
    let submitted_at = read_anchor::<Submission>(&harness.svm, &submission_address).submitted_at;
    harness
        .report_with(VIDEO_A, 1_000, submitted_at, false, false)
        .unwrap();
    harness.review(VIDEO_A, false).unwrap();
    harness
        .report_with(VIDEO_A, 26_000, submitted_at + 1, false, false)
        .unwrap();

    let wrong_owner_claim = Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::Claim {
            config: harness.config,
            campaign: harness.campaign,
            vault: harness.vault,
            submission: submission_address,
            report,
            clipper_token_account: harness.creator_token,
            mint: harness.mint,
            clipper: harness.clipper.pubkey(),
            token_program: anchor_spl::token::ID,
        }
        .to_account_metas(None),
        data: crate::instruction::Claim {}.data(),
    };
    assert!(send(
        &mut harness.svm,
        &harness.clipper,
        &[&harness.clipper],
        wrong_owner_claim,
    )
    .is_err());

    harness.claim(VIDEO_A).unwrap();
    let clipper_account: TokenAccount =
        get_spl_account(&harness.svm, &harness.clipper_token).unwrap();
    assert_eq!(clipper_account.amount, 20_000_000);
    let submission: Submission = read_anchor(&harness.svm, &submission_address);
    assert_eq!(submission.total_paid, 20_000_000);

    harness.top_up(30_000_000).unwrap();
    harness.claim(VIDEO_A).unwrap();
    let clipper_account: TokenAccount =
        get_spl_account(&harness.svm, &harness.clipper_token).unwrap();
    assert_eq!(clipper_account.amount, 50_000_000);
    assert!(harness.claim(VIDEO_A).is_err());

    set_time(&mut harness.svm, harness.end + 1);
    assert!(harness.top_up(1).is_err());

    let early_close_report = Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::CloseReport {
            campaign: harness.campaign,
            report,
            config: harness.config,
            recipient: harness.oracle.pubkey(),
            signer: harness.oracle.pubkey(),
        }
        .to_account_metas(None),
        data: crate::instruction::CloseReport {}.data(),
    };
    assert!(send(
        &mut harness.svm,
        &harness.oracle,
        &[&harness.oracle],
        early_close_report,
    )
    .is_err());
    let early_close_submission = Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::CloseSubmission {
            campaign: harness.campaign,
            submission: submission_address,
            clipper: harness.clipper.pubkey(),
        }
        .to_account_metas(None),
        data: crate::instruction::CloseSubmission {}.data(),
    };
    assert!(send(
        &mut harness.svm,
        &harness.clipper,
        &[&harness.clipper],
        early_close_submission,
    )
    .is_err());
    let early_close_stats = Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::CloseStats {
            campaign: harness.campaign,
            stats,
            clipper: harness.clipper.pubkey(),
        }
        .to_account_metas(None),
        data: crate::instruction::CloseStats {}.data(),
    };
    assert!(send(
        &mut harness.svm,
        &harness.clipper,
        &[&harness.clipper],
        early_close_stats,
    )
    .is_err());

    set_time(&mut harness.svm, harness.settlement_end);
    assert!(harness.refund().is_err());
    set_time(&mut harness.svm, harness.settlement_end + 1);

    let clipper_before_submission_close = harness
        .svm
        .get_account(&harness.clipper.pubkey())
        .unwrap()
        .lamports;
    let close_submission = Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::CloseSubmission {
            campaign: harness.campaign,
            submission: submission_address,
            clipper: harness.clipper.pubkey(),
        }
        .to_account_metas(None),
        data: crate::instruction::CloseSubmission {}.data(),
    };
    send(
        &mut harness.svm,
        &harness.clipper,
        &[&harness.clipper],
        close_submission,
    )
    .unwrap();
    assert!(harness.svm.get_account(&submission_address).is_none());
    assert!(
        harness
            .svm
            .get_account(&harness.clipper.pubkey())
            .unwrap()
            .lamports
            > clipper_before_submission_close
    );

    let oracle_lamports_before = harness
        .svm
        .get_account(&harness.oracle.pubkey())
        .unwrap()
        .lamports;
    let close_report = Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::CloseReport {
            campaign: harness.campaign,
            report,
            config: harness.config,
            recipient: harness.oracle.pubkey(),
            signer: harness.oracle.pubkey(),
        }
        .to_account_metas(None),
        data: crate::instruction::CloseReport {}.data(),
    };
    send(
        &mut harness.svm,
        &harness.oracle,
        &[&harness.oracle],
        close_report,
    )
    .unwrap();
    assert!(harness.svm.get_account(&report).is_none());
    assert!(
        harness
            .svm
            .get_account(&harness.oracle.pubkey())
            .unwrap()
            .lamports
            > oracle_lamports_before
    );

    let clipper_before_stats_close = harness
        .svm
        .get_account(&harness.clipper.pubkey())
        .unwrap()
        .lamports;
    let close_stats = Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::CloseStats {
            campaign: harness.campaign,
            stats,
            clipper: harness.clipper.pubkey(),
        }
        .to_account_metas(None),
        data: crate::instruction::CloseStats {}.data(),
    };
    send(
        &mut harness.svm,
        &harness.clipper,
        &[&harness.clipper],
        close_stats,
    )
    .unwrap();
    assert!(harness.svm.get_account(&stats).is_none());
    assert!(
        harness
            .svm
            .get_account(&harness.clipper.pubkey())
            .unwrap()
            .lamports
            > clipper_before_stats_close
    );

    harness.refund().unwrap();
    assert!(harness.svm.get_account(&harness.vault).is_none());
    let campaign: Campaign = read_anchor(&harness.svm, &harness.campaign);
    assert_eq!(campaign.status, crate::state::CampaignStatus::Closed);
    assert!(harness.refund().is_err());
}

#[test]
fn runtime_config_rotation_and_two_step_admin_transfer() {
    let mut harness = Harness::new(60_000_000);
    let unauthorized_update = Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::UpdateOracle {
            config: harness.config,
            admin: harness.clipper.pubkey(),
        }
        .to_account_metas(None),
        data: crate::instruction::UpdateOracle {
            new_oracle: harness.new_oracle.pubkey(),
        }
        .data(),
    };
    assert!(send(
        &mut harness.svm,
        &harness.clipper,
        &[&harness.clipper],
        unauthorized_update,
    )
    .is_err());

    let propose = Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::ProposeAdmin {
            config: harness.config,
            admin: harness.admin.pubkey(),
        }
        .to_account_metas(None),
        data: crate::instruction::ProposeAdmin {
            new_admin: harness.clipper.pubkey(),
        }
        .data(),
    };
    send(&mut harness.svm, &harness.admin, &[&harness.admin], propose).unwrap();

    let wrong_accept = Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::AcceptAdmin {
            config: harness.config,
            new_admin: harness.new_oracle.pubkey(),
        }
        .to_account_metas(None),
        data: crate::instruction::AcceptAdmin {}.data(),
    };
    assert!(send(
        &mut harness.svm,
        &harness.new_oracle,
        &[&harness.new_oracle],
        wrong_accept,
    )
    .is_err());

    let accept = Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::AcceptAdmin {
            config: harness.config,
            new_admin: harness.clipper.pubkey(),
        }
        .to_account_metas(None),
        data: crate::instruction::AcceptAdmin {}.data(),
    };
    send(
        &mut harness.svm,
        &harness.clipper,
        &[&harness.clipper],
        accept,
    )
    .unwrap();
    let config: Config = read_anchor(&harness.svm, &harness.config);
    assert_eq!(config.admin, harness.clipper.pubkey());
    assert!(config.pending_admin.is_none());

    assert!(harness.rotate_oracle().is_err());
    let update = Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::UpdateOracle {
            config: harness.config,
            admin: harness.clipper.pubkey(),
        }
        .to_account_metas(None),
        data: crate::instruction::UpdateOracle {
            new_oracle: harness.new_oracle.pubkey(),
        }
        .data(),
    };
    send(
        &mut harness.svm,
        &harness.clipper,
        &[&harness.clipper],
        update,
    )
    .unwrap();
}

#[test]
fn runtime_clock_skew_baseline_final_and_post_end_acceptance() {
    let mut harness = Harness::new(60_000_000);
    harness.register(VIDEO_A, TERMS_HASH).unwrap();
    let submitted_at =
        read_anchor::<Submission>(&harness.svm, &harness.submission_addresses(VIDEO_A).0)
            .submitted_at;

    harness
        .report_with(VIDEO_A, 1_000, submitted_at - 10, false, false)
        .unwrap();
    harness
        .report_with(VIDEO_A, 1_100, submitted_at + 10, false, false)
        .unwrap();
    assert!(harness
        .report_with(VIDEO_A, 1_200, submitted_at + 11, false, false)
        .is_err());
    assert!(harness.claim(VIDEO_A).is_err());

    harness.register(VIDEO_B, TERMS_HASH).unwrap();
    assert!(harness
        .report_with(VIDEO_B, 1_000, submitted_at - 11, false, false)
        .is_err());
    harness
        .report_with(VIDEO_B, 1_000, submitted_at, false, false)
        .unwrap();

    set_time(&mut harness.svm, harness.end + 1);
    harness
        .report_with(VIDEO_B, 26_000, harness.end, true, false)
        .unwrap();
    harness.finalize(VIDEO_B).unwrap();
    harness.claim(VIDEO_B).unwrap();
    let submission: Submission =
        read_anchor(&harness.svm, &harness.submission_addresses(VIDEO_B).0);
    assert_eq!(submission.status, SubmissionStatus::Accepted);
    assert!(submission.accepted_at.unwrap() > harness.end);
}

#[test]
fn runtime_quota_total_limit_and_appeal_when_full() {
    let mut harness = Harness::new(60_000_000);
    harness.register(VIDEO_A, TERMS_HASH).unwrap();
    harness.review(VIDEO_A, true).unwrap();

    for index in 0..5 {
        let video = format!("Quota{:06}", index);
        harness.register(&video, TERMS_HASH).unwrap();
    }
    assert!(harness.appeal(VIDEO_A).is_err());
    harness.review("Quota000000", true).unwrap();
    harness.appeal(VIDEO_A).unwrap();

    let (_, stats_address, _) = harness.submission_addresses(VIDEO_A);
    let stats: ClipperStats = read_anchor(&harness.svm, &stats_address);
    assert_eq!(stats.active_count, 5);

    let mut cycle = Harness::new(60_000_000);
    for index in 0..10 {
        let video = format!("Cycle{:06}", index);
        cycle.register(&video, TERMS_HASH).unwrap();
        cycle.review(&video, true).unwrap();
    }
    assert!(cycle.register("Cycle999999", TERMS_HASH).is_err());
    let (_, stats_address, _) = cycle.submission_addresses("Cycle000000");
    let stats: ClipperStats = read_anchor(&cycle.svm, &stats_address);
    assert_eq!(stats.active_count, 0);
    assert_eq!(stats.total_submitted, 10);
}

#[test]
fn runtime_oracle_baseline_fallback_and_invalid_reporter_claim() {
    let mut harness = Harness::new(60_000_000);
    harness.register(VIDEO_A, TERMS_HASH).unwrap();
    let submitted_at =
        read_anchor::<Submission>(&harness.svm, &harness.submission_addresses(VIDEO_A).0)
            .submitted_at;
    assert!(harness
        .report_with(VIDEO_A, 2_000, submitted_at, true, false)
        .is_err());
    harness
        .report_with(VIDEO_A, 1_000, submitted_at, false, false)
        .unwrap();
    harness.review(VIDEO_A, false).unwrap();
    harness
        .report_with(VIDEO_A, 11_000, submitted_at + 1, false, false)
        .unwrap();

    harness.register(VIDEO_B, TERMS_HASH).unwrap();
    harness.register(VIDEO_C, TERMS_HASH).unwrap();
    harness
        .report_with(VIDEO_C, 1_000, submitted_at, false, false)
        .unwrap();
    harness.review(VIDEO_C, false).unwrap();
    harness
        .report_with(VIDEO_C, 6_000, submitted_at + 1, false, false)
        .unwrap();
    harness.rotate_oracle().unwrap();
    assert!(harness.claim(VIDEO_C).is_err());
    harness
        .report_with(VIDEO_C, 5_000, submitted_at + 2, false, true)
        .unwrap();
    harness.claim(VIDEO_C).unwrap();

    set_time(&mut harness.svm, harness.end + 1);
    harness
        .report_with(VIDEO_B, 1_000, harness.end + 1, false, true)
        .unwrap();
    let baseline_submission: Submission =
        read_anchor(&harness.svm, &harness.submission_addresses(VIDEO_B).0);
    assert_eq!(baseline_submission.baseline_views, Some(1_000));

    set_time(&mut harness.svm, harness.end + 61);
    assert!(harness
        .report_with(VIDEO_B, 2_000, harness.end + 61, true, true)
        .is_err());
    harness
        .report_with(VIDEO_A, 11_000, harness.end, false, true)
        .unwrap();
    set_time(&mut harness.svm, harness.settlement_end);
    harness.claim(VIDEO_A).unwrap();
}

#[test]
fn runtime_exact_review_appeal_boundaries_and_submission_guards() {
    let mut harness = Harness::new(60_000_000);
    set_time(&mut harness.svm, harness.start - 1);
    assert!(harness.register(VIDEO_A, TERMS_HASH).is_err());
    set_time(&mut harness.svm, harness.start);
    harness.register(VIDEO_A, TERMS_HASH).unwrap();
    assert!(harness.register(VIDEO_A, TERMS_HASH).is_err());

    harness.review(VIDEO_A, true).unwrap();
    let rejected =
        read_anchor::<Submission>(&harness.svm, &harness.submission_addresses(VIDEO_A).0);
    set_time(&mut harness.svm, rejected.rejected_at.unwrap() + 20);
    harness.appeal(VIDEO_A).unwrap();
    let appealed =
        read_anchor::<Submission>(&harness.svm, &harness.submission_addresses(VIDEO_A).0);
    set_time(&mut harness.svm, appealed.appealed_at.unwrap() + 20);
    harness.review(VIDEO_A, false).unwrap();

    harness.register(VIDEO_B, TERMS_HASH).unwrap();
    harness.review(VIDEO_B, true).unwrap();
    assert!(harness.review(VIDEO_B, false).is_err());
    harness.appeal(VIDEO_B).unwrap();
    let appealed =
        read_anchor::<Submission>(&harness.svm, &harness.submission_addresses(VIDEO_B).0);
    set_time(&mut harness.svm, appealed.appealed_at.unwrap() + 20);
    assert!(harness.finalize(VIDEO_B).is_err());
    set_time(&mut harness.svm, appealed.appealed_at.unwrap() + 21);
    harness.finalize(VIDEO_B).unwrap();

    set_time(&mut harness.svm, harness.end + 1);
    assert!(harness.register(VIDEO_C, TERMS_HASH).is_err());

    set_time(&mut harness.svm, harness.start);
    let self_video = "SelfVideo01";
    let (self_submission, _) = Pubkey::find_program_address(
        &[
            b"submission",
            harness.campaign.as_ref(),
            self_video.as_bytes(),
        ],
        &PROGRAM_ID,
    );
    let (self_stats, _) = Pubkey::find_program_address(
        &[
            b"stats",
            harness.campaign.as_ref(),
            harness.creator.pubkey().as_ref(),
        ],
        &PROGRAM_ID,
    );
    let self_register = Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::RegisterSubmission {
            campaign: harness.campaign,
            submission: self_submission,
            stats: self_stats,
            clipper: harness.creator.pubkey(),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: crate::instruction::RegisterSubmission {
            video_id: self_video.to_owned(),
            terms_hash: TERMS_HASH,
        }
        .data(),
    };
    assert!(send(
        &mut harness.svm,
        &harness.creator,
        &[&harness.creator],
        self_register,
    )
    .is_err());
}

#[test]
fn runtime_initialize_config_requires_upgrade_authority_and_is_single_use() {
    use anchor_lang::solana_program::bpf_loader_upgradeable::{self, UpgradeableLoaderState};

    let mut svm = new_svm();
    let payer = Keypair::new();
    let admin = Keypair::new();
    let oracle = Keypair::new();
    let upgrade_authority = Keypair::new();
    let impostor = Keypair::new();
    for signer in [&payer, &admin, &oracle, &upgrade_authority, &impostor] {
        svm.airdrop(&signer.pubkey(), 10_000_000_000).unwrap();
    }
    set_time(&mut svm, 1_800_000_000);

    let (program_data, _) =
        Pubkey::find_program_address(&[PROGRAM_ID.as_ref()], &bpf_loader_upgradeable::ID);
    let mut program_data_account = svm.get_account(&program_data).unwrap();
    let metadata_len = UpgradeableLoaderState::size_of_programdata_metadata();
    bincode::serialize_into(
        &mut program_data_account.data[..metadata_len],
        &UpgradeableLoaderState::ProgramData {
            slot: 1,
            upgrade_authority_address: Some(upgrade_authority.pubkey()),
        },
    )
    .unwrap();
    svm.set_account(program_data, program_data_account).unwrap();

    let (config, _) = Pubkey::find_program_address(&[b"config"], &PROGRAM_ID);
    let make_instruction = |authority: Pubkey, admin_arg: Pubkey| Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::InitializeConfig {
            config,
            payer: payer.pubkey(),
            admin: admin.pubkey(),
            upgrade_authority: authority,
            program_data,
            program: PROGRAM_ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: crate::instruction::InitializeConfig {
            admin: admin_arg,
            oracle: oracle.pubkey(),
        }
        .data(),
    };

    assert!(send(
        &mut svm,
        &payer,
        &[&payer, &admin, &impostor],
        make_instruction(impostor.pubkey(), admin.pubkey()),
    )
    .is_err());
    assert!(svm.get_account(&config).is_none());

    assert!(send(
        &mut svm,
        &payer,
        &[&payer, &admin, &upgrade_authority],
        make_instruction(upgrade_authority.pubkey(), impostor.pubkey()),
    )
    .is_err());
    assert!(svm.get_account(&config).is_none());

    send(
        &mut svm,
        &payer,
        &[&payer, &admin, &upgrade_authority],
        make_instruction(upgrade_authority.pubkey(), admin.pubkey()),
    )
    .unwrap();
    let config_state: Config = read_anchor(&svm, &config);
    assert_eq!(config_state.admin, admin.pubkey());
    assert_eq!(config_state.oracle, oracle.pubkey());

    assert!(send(
        &mut svm,
        &payer,
        &[&payer, &admin, &upgrade_authority],
        make_instruction(upgrade_authority.pubkey(), admin.pubkey()),
    )
    .is_err());
}

#[test]
fn runtime_account_security_wrong_mint_pda_signer_and_reinitialization() {
    let mut harness = Harness::new(60_000_000);
    harness.register(VIDEO_A, TERMS_HASH).unwrap();
    let (submission, stats, report) = harness.submission_addresses(VIDEO_A);
    let submitted_at = read_anchor::<Submission>(&harness.svm, &submission).submitted_at;
    harness
        .report_with(VIDEO_A, 1_000, submitted_at, false, false)
        .unwrap();
    harness.review(VIDEO_A, false).unwrap();
    harness
        .report_with(VIDEO_A, 2_000, submitted_at + 1, false, false)
        .unwrap();

    let substituted_report_claim = Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::Claim {
            config: harness.config,
            campaign: harness.campaign,
            vault: harness.vault,
            submission,
            report: stats,
            clipper_token_account: harness.clipper_token,
            mint: harness.mint,
            clipper: harness.clipper.pubkey(),
            token_program: anchor_spl::token::ID,
        }
        .to_account_metas(None),
        data: crate::instruction::Claim {}.data(),
    };
    assert!(send(
        &mut harness.svm,
        &harness.clipper,
        &[&harness.clipper],
        substituted_report_claim,
    )
    .is_err());

    let wrong_signer_claim = Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::Claim {
            config: harness.config,
            campaign: harness.campaign,
            vault: harness.vault,
            submission,
            report,
            clipper_token_account: harness.creator_token,
            mint: harness.mint,
            clipper: harness.creator.pubkey(),
            token_program: anchor_spl::token::ID,
        }
        .to_account_metas(None),
        data: crate::instruction::Claim {}.data(),
    };
    assert!(send(
        &mut harness.svm,
        &harness.creator,
        &[&harness.creator],
        wrong_signer_claim,
    )
    .is_err());

    let wrong_mint = CreateMint::new(&mut harness.svm, &harness.creator)
        .decimals(6)
        .send()
        .unwrap();
    let wrong_token = CreateTokenAccount::new(&mut harness.svm, &harness.creator, &wrong_mint)
        .owner(&harness.creator.pubkey())
        .send()
        .unwrap();
    let wrong_mint_top_up = Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::TopUp {
            campaign: harness.campaign,
            vault: harness.vault,
            creator_token_account: wrong_token,
            mint: wrong_mint,
            creator: harness.creator.pubkey(),
            token_program: anchor_spl::token::ID,
        }
        .to_account_metas(None),
        data: crate::instruction::TopUp { amount: 1 }.data(),
    };
    assert!(send(
        &mut harness.svm,
        &harness.creator,
        &[&harness.creator],
        wrong_mint_top_up,
    )
    .is_err());

    let reinitialize = Instruction {
        program_id: PROGRAM_ID,
        accounts: crate::accounts::InitializeCampaign {
            campaign: harness.campaign,
            mint: harness.mint,
            creator: harness.creator.pubkey(),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: crate::instruction::InitializeCampaign {
            params: crate::instructions::InitializeCampaignParams {
                campaign_id: 7,
                terms_hash: TERMS_HASH,
                cpm: 2_000_000,
                max_payout_per_video: 50_000_000,
                budget: 60_000_000,
                start_time: harness.start,
                end_time: harness.end,
                review_period: 20,
                appeal_window: 20,
                appeal_timeout: 20,
                settlement_period: 180,
                max_report_age: 30,
                final_snapshot_tolerance: 60,
                clock_skew_tolerance: 10,
                max_videos_per_clipper: 5,
            },
        }
        .data(),
    };
    assert!(send(
        &mut harness.svm,
        &harness.creator,
        &[&harness.creator],
        reinitialize,
    )
    .is_err());
}
