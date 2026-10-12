import {
  address,
  getAddressEncoder,
  getBytesEncoder,
  getProgramDerivedAddress,
} from "@solana/kit";

const DEFAULT_PROGRAM_ID = "5qjmvHtiiMPS4U9HsodyUhMw297WsRmSpqeesEZgcupy";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const RENT_SYSVAR = "SysvarRent111111111111111111111111111111111";

export const vaultProgramId = () =>
  process.env.VAULT_PROGRAM_ID || DEFAULT_PROGRAM_ID;

const textSeed = (value) => getBytesEncoder().encode(Buffer.from(value));
const addressSeed = (value) => getAddressEncoder().encode(address(value));
const u64Seed = (value) => {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true);
  return bytes;
};

async function pda(seeds, program = vaultProgramId()) {
  return (
    await getProgramDerivedAddress({
      programAddress: address(program),
      seeds,
    })
  )[0];
}

export const deriveConfigAddress = () => pda([textSeed("config")]);
export const deriveCampaignAddress = (creator, campaignId) =>
  pda([textSeed("campaign"), addressSeed(creator), u64Seed(campaignId)]);
export const deriveVaultAddress = (campaign) =>
  pda([textSeed("vault"), addressSeed(campaign)]);
export const deriveSubmissionAddress = (campaign, videoId) =>
  pda([textSeed("submission"), addressSeed(campaign), textSeed(videoId)]);
export const deriveStatsAddress = (campaign, clipper) =>
  pda([textSeed("stats"), addressSeed(campaign), addressSeed(clipper)]);
export const deriveReportAddress = (submission) =>
  pda([textSeed("report"), addressSeed(submission)]);
export const deriveAtaAddress = (owner, mint) =>
  pda(
    [addressSeed(owner), addressSeed(TOKEN_PROGRAM), addressSeed(mint)],
    ASSOCIATED_TOKEN_PROGRAM
  );

function intent(instructions, signer) {
  return {
    format: "acai-transaction-intent-v1",
    programId: vaultProgramId(),
    feePayer: signer,
    transactionVersion: Number(process.env.SOLANA_TRANSACTION_VERSION || 1),
    instructions,
  };
}

export async function buildCreateCampaignIntent(input, creator) {
  const { cpmBaseUnits, ...campaignArgs } = input;
  campaignArgs.cpm = input.cpm ?? cpmBaseUnits;
  const campaign = await deriveCampaignAddress(creator, input.campaignId);
  const vault = await deriveVaultAddress(campaign);
  const creatorTokenAccount = await deriveAtaAddress(
    creator,
    input.paymentMint
  );
  return {
    campaign,
    transaction: intent(
      [
        {
          name: "initialize_campaign",
          accounts: {
            campaign,
            mint: input.paymentMint,
            creator,
            systemProgram: SYSTEM_PROGRAM,
          },
          args: campaignArgs,
        },
        {
          name: "fund_campaign",
          accounts: {
            campaign,
            vault,
            creatorTokenAccount,
            mint: input.paymentMint,
            creator,
            tokenProgram: TOKEN_PROGRAM,
            systemProgram: SYSTEM_PROGRAM,
            rent: RENT_SYSVAR,
          },
          args: {},
        },
      ],
      creator
    ),
  };
}

export async function buildRegisterSubmissionIntent({
  campaign,
  clipper,
  videoId,
  termsHash,
}) {
  const submission = await deriveSubmissionAddress(campaign, videoId);
  const stats = await deriveStatsAddress(campaign, clipper);
  return intent(
    [
      {
        name: "register_submission",
        accounts: {
          campaign,
          submission,
          stats,
          clipper,
          systemProgram: SYSTEM_PROGRAM,
        },
        args: { videoId, termsHash },
      },
    ],
    clipper
  );
}

export async function buildClaimIntent({
  campaign,
  submission,
  vault,
  mint,
  clipper,
}) {
  const config = await deriveConfigAddress();
  const report = await deriveReportAddress(submission);
  const clipperTokenAccount = await deriveAtaAddress(clipper, mint);
  return intent(
    [
      {
        name: "create_associated_token_account_idempotent",
        programId: ASSOCIATED_TOKEN_PROGRAM,
        accounts: {
          payer: clipper,
          associatedToken: clipperTokenAccount,
          owner: clipper,
          mint,
          systemProgram: SYSTEM_PROGRAM,
          tokenProgram: TOKEN_PROGRAM,
        },
        args: {},
      },
      {
        name: "claim",
        accounts: {
          config,
          campaign,
          vault,
          submission,
          report,
          clipperTokenAccount,
          mint,
          clipper,
          tokenProgram: TOKEN_PROGRAM,
        },
        args: {},
      },
    ],
    clipper
  );
}

export async function buildRefundIntent({
  campaign,
  creator,
  mint,
}) {
  const vault = await deriveVaultAddress(campaign);
  const creatorTokenAccount = await deriveAtaAddress(creator, mint);
  return intent(
    [
      {
        name: "create_associated_token_account_idempotent",
        programId: ASSOCIATED_TOKEN_PROGRAM,
        accounts: {
          payer: creator,
          associatedToken: creatorTokenAccount,
          owner: creator,
          mint,
          systemProgram: SYSTEM_PROGRAM,
          tokenProgram: TOKEN_PROGRAM,
        },
        args: {},
      },
      {
        name: "refund",
        accounts: {
          campaign,
          vault,
          creatorTokenAccount,
          mint,
          creator,
          tokenProgram: TOKEN_PROGRAM,
        },
        args: {},
      },
    ],
    creator
  );
}

export async function buildAcceptSubmissionIntent({
  campaign,
  submission,
  clipper,
  creator,
}) {
  const stats = await deriveStatsAddress(campaign, clipper);
  return intent(
    [
      {
        name: "accept_submission",
        accounts: {
          campaign,
          submission,
          stats,
          creator,
        },
        args: {},
      },
    ],
    creator
  );
}

export async function buildRejectSubmissionIntent({
  campaign,
  submission,
  clipper,
  creator,
  reasonHash,
}) {
  const stats = await deriveStatsAddress(campaign, clipper);
  const formattedReason = Array.isArray(reasonHash)
    ? reasonHash
    : Array.from(Buffer.from(reasonHash.padStart(64, "0"), "hex"));
  return intent(
    [
      {
        name: "reject_submission",
        accounts: {
          campaign,
          submission,
          stats,
          creator,
        },
        args: { reason_hash: formattedReason },
      },
    ],
    creator
  );
}
