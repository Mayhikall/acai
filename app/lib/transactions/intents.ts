import {
  AccountRole,
  address,
  type Address,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";
import {
  getAcceptSubmissionInstruction,
  getAppealSubmissionInstruction,
  getClaimInstruction,
  getFinalizeTimeoutInstruction,
  getFundCampaignInstruction,
  getInitializeCampaignInstruction,
  getRefundInstruction,
  getRegisterSubmissionInstruction,
  getRejectSubmissionInstruction,
  getTopUpInstruction,
} from "@/app/generated/vault/instructions";
import { VAULT_PROGRAM_ADDRESS } from "@/app/generated/vault/programs";

export const AUSDC_MINT = address(
  "67tawTkJ6Ft2k7SJER8KuP1aQBbgdZMrFyJfUJT7tzZU"
);
const ASSOCIATED_TOKEN_PROGRAM = address(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

export type IntentInstruction = {
  name: string;
  programId?: string;
  accounts: Record<string, string>;
  args: Record<string, unknown>;
};

export type TransactionIntent = {
  format: "acai-transaction-intent-v1";
  programId: string;
  feePayer: string;
  transactionVersion: number;
  instructions: IntentInstruction[];
};

const ALLOWED = new Set([
  "initialize_campaign",
  "fund_campaign",
  "register_submission",
  "accept_submission",
  "reject_submission",
  "appeal_submission",
  "finalize_timeout",
  "claim",
  "refund",
  "top_up",
  "create_associated_token_account_idempotent",
]);

function hex32(value: unknown) {
  if (Array.isArray(value) && value.length === 32) return new Uint8Array(value);
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error("Intent contains an invalid 32-byte hash");
  }
  return Uint8Array.from(
    value.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
  );
}

function bigint(value: unknown) {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "bigint"
  )
    throw new Error("Intent contains an invalid integer");
  return BigInt(value);
}

function number(value: unknown) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed))
    throw new Error("Intent contains an invalid number");
  return parsed;
}

function account(accounts: Record<string, string>, key: string): Address {
  if (!accounts[key]) throw new Error(`Intent account ${key} is missing`);
  return address(accounts[key]);
}

function ataInstruction(accounts: Record<string, string>): Instruction {
  return {
    programAddress: ASSOCIATED_TOKEN_PROGRAM,
    accounts: [
      {
        address: account(accounts, "payer"),
        role: AccountRole.WRITABLE_SIGNER,
      },
      {
        address: account(accounts, "associatedToken"),
        role: AccountRole.WRITABLE,
      },
      { address: account(accounts, "owner"), role: AccountRole.READONLY },
      { address: account(accounts, "mint"), role: AccountRole.READONLY },
      {
        address: account(accounts, "systemProgram"),
        role: AccountRole.READONLY,
      },
      {
        address: account(accounts, "tokenProgram"),
        role: AccountRole.READONLY,
      },
    ],
    data: new Uint8Array([1]),
  };
}

export function validateIntent(
  intent: TransactionIntent,
  signer: TransactionSigner,
  supportedVersions: readonly ("legacy" | 0 | 1)[]
) {
  if (intent.format !== "acai-transaction-intent-v1")
    throw new Error("Unknown transaction intent format");
  if (intent.programId !== VAULT_PROGRAM_ADDRESS)
    throw new Error("Intent targets an unexpected program");
  if (intent.feePayer !== signer.address)
    throw new Error("Intent fee payer does not match the connected wallet");
  if (
    ![0, 1].includes(intent.transactionVersion) ||
    !supportedVersions.includes(intent.transactionVersion as 0 | 1)
  )
    throw new Error(
      `Wallet does not support transaction v${intent.transactionVersion}`
    );
  if (
    !intent.instructions.length ||
    intent.instructions.some((item) => !ALLOWED.has(item.name))
  )
    throw new Error("Intent contains an unsupported instruction");
  for (const item of intent.instructions) {
    if (
      item.programId &&
      item.programId !== ASSOCIATED_TOKEN_PROGRAM &&
      item.programId !== VAULT_PROGRAM_ADDRESS
    )
      throw new Error("Intent contains an unexpected program");
    Object.values(item.accounts).forEach((value) => address(value));
    if (item.accounts.mint && item.accounts.mint !== AUSDC_MINT)
      throw new Error("Intent uses an unsupported payment mint");
    for (const signerKey of ["creator", "clipper", "payer"]) {
      if (
        item.accounts[signerKey] &&
        item.accounts[signerKey] !== signer.address
      )
        throw new Error(`Intent signer ${signerKey} does not match the wallet`);
    }
  }
}

export function compileIntent(
  intent: TransactionIntent,
  signer: TransactionSigner
): Instruction[] {
  return intent.instructions.map((item) => {
    const a = item.accounts;
    const args = item.args;
    switch (item.name) {
      case "create_associated_token_account_idempotent":
        return ataInstruction(a);
      case "initialize_campaign":
        return getInitializeCampaignInstruction({
          campaign: account(a, "campaign"),
          mint: account(a, "mint"),
          creator: signer,
          systemProgram: account(a, "systemProgram"),
          campaignId: bigint(args.campaignId),
          termsHash: hex32(args.termsHash),
          cpm: bigint(args.cpm),
          maxPayoutPerVideo: bigint(args.maxPayoutPerVideo),
          budget: bigint(args.budget),
          startTime: bigint(args.startTime),
          endTime: bigint(args.endTime),
          reviewPeriod: bigint(args.reviewPeriod),
          appealWindow: bigint(args.appealWindow),
          appealTimeout: bigint(args.appealTimeout),
          settlementPeriod: bigint(args.settlementPeriod),
          maxReportAge: bigint(args.maxReportAge),
          finalSnapshotTolerance: bigint(args.finalSnapshotTolerance),
          clockSkewTolerance: bigint(args.clockSkewTolerance),
          maxVideosPerClipper: number(args.maxVideosPerClipper),
        });
      case "fund_campaign":
        return getFundCampaignInstruction({
          campaign: account(a, "campaign"),
          vault: account(a, "vault"),
          creatorTokenAccount: account(a, "creatorTokenAccount"),
          mint: account(a, "mint"),
          creator: signer,
          tokenProgram: account(a, "tokenProgram"),
          systemProgram: account(a, "systemProgram"),
          rent: account(a, "rent"),
        });
      case "register_submission":
        return getRegisterSubmissionInstruction({
          campaign: account(a, "campaign"),
          submission: account(a, "submission"),
          stats: account(a, "stats"),
          clipper: signer,
          systemProgram: account(a, "systemProgram"),
          videoId: String(args.videoId),
          termsHash: hex32(args.termsHash),
        });
      case "accept_submission":
        return getAcceptSubmissionInstruction({
          campaign: account(a, "campaign"),
          submission: account(a, "submission"),
          stats: account(a, "stats"),
          creator: signer,
        });
      case "reject_submission":
        return getRejectSubmissionInstruction({
          campaign: account(a, "campaign"),
          submission: account(a, "submission"),
          stats: account(a, "stats"),
          creator: signer,
          reasonHash: hex32(args.reason_hash ?? args.reasonHash),
        });
      case "appeal_submission":
        return getAppealSubmissionInstruction({
          campaign: account(a, "campaign"),
          submission: account(a, "submission"),
          stats: account(a, "stats"),
          clipper: signer,
        });
      case "finalize_timeout":
        return getFinalizeTimeoutInstruction({
          campaign: account(a, "campaign"),
          submission: account(a, "submission"),
        });
      case "claim":
        return getClaimInstruction({
          config: account(a, "config"),
          campaign: account(a, "campaign"),
          vault: account(a, "vault"),
          submission: account(a, "submission"),
          report: account(a, "report"),
          clipperTokenAccount: account(a, "clipperTokenAccount"),
          mint: account(a, "mint"),
          clipper: signer,
          tokenProgram: account(a, "tokenProgram"),
        });
      case "refund":
        return getRefundInstruction({
          campaign: account(a, "campaign"),
          vault: account(a, "vault"),
          creatorTokenAccount: account(a, "creatorTokenAccount"),
          mint: account(a, "mint"),
          creator: signer,
          tokenProgram: account(a, "tokenProgram"),
        });
      case "top_up":
        return getTopUpInstruction({
          campaign: account(a, "campaign"),
          vault: account(a, "vault"),
          creatorTokenAccount: account(a, "creatorTokenAccount"),
          mint: account(a, "mint"),
          creator: signer,
          tokenProgram: account(a, "tokenProgram"),
          amount: bigint(args.amount),
        });
      default:
        throw new Error(`Unsupported instruction: ${item.name}`);
    }
  });
}
