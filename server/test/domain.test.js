import test from "node:test";
import assert from "node:assert/strict";
import {
  createAuthNonce,
  createSignInMessage,
} from "../src/services/auth-message.js";
import { calculateRemainingClaim } from "../src/services/claims.js";
import { parseIsoDuration } from "../src/services/youtube/api.js";
import { detectAnomaly } from "../src/services/oracle-worker.js";
import { AppError } from "../src/lib/errors.js";
import { assertCampaignIntentMatchesEvent } from "../src/services/indexer.js";
import {
  isQuarantinableIndexerError,
  processDecodedEvents,
} from "../src/services/chain-indexer.js";
import {
  buildAcceptSubmissionIntent,
  buildClaimIntent,
  buildCreateCampaignIntent,
  buildRefundIntent,
  buildRegisterSubmissionIntent,
  buildRejectSubmissionIntent,
} from "../src/services/transaction-intents.js";

test("auth message binds domain, URI, chain, nonce, and expiration", () => {
  const message = createSignInMessage({
    domain: "acai.test",
    uri: "https://acai.test",
    wallet: "wallet",
    nonce: "nonce1234",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expirationTime: "2026-01-01T00:05:00.000Z",
    chain: "devnet",
  });
  assert.match(message, /acai\.test wants you to sign in/);
  assert.match(message, /Chain ID: solana:devnet/);
  assert.match(message, /Nonce: nonce1234/);
  assert.match(message, /Expiration Time:/);
});

test("auth nonce format is compatible with Sign In With Solana", () => {
  const nonce = createAuthNonce();
  assert.match(nonce, /^[A-Za-z0-9]{8,}$/);
});

test("remaining claim supports partial payout without new views", () => {
  const result = calculateRemainingClaim({
    viewCount: 20500,
    baselineViews: 500,
    cpm: 2000000,
    maxPayoutPerVideo: 50000000,
    totalPaid: 10000000,
  });
  assert.deepEqual(result, {
    eligibleViews: "20000",
    entitlement: "40000000",
    remaining: "30000000",
  });
});

test("CPM uses token base units without losing sub-1000-view payouts", () => {
  assert.equal(
    calculateRemainingClaim({
      viewCount: 1,
      baselineViews: 0,
      cpm: 2000000,
      maxPayoutPerVideo: 50000000,
      totalPaid: 0,
    }).entitlement,
    "2000"
  );
});

test("YouTube ISO duration parser handles hours, minutes, and seconds", () => {
  assert.equal(parseIsoDuration("PT1H2M3S"), 3723);
  assert.equal(parseIsoDuration("PT58S"), 58);
});

test("oracle anomaly cold start only applies the absolute threshold", () => {
  const original = process.env.ANOMALY_CHECK_ENABLED;
  process.env.ANOMALY_CHECK_ENABLED = "true";
  const fetchedAt = new Date(Date.now() - 3_600_000);
  assert.equal(
    detectAnomaly({
      snapshots: [{ view_count: 100, fetched_at: fetchedAt }],
      nextViewCount: 150,
      maxGrowthPerHour: 100,
      multiplier: 10,
    }),
    null
  );
  assert.match(
    detectAnomaly({
      snapshots: [{ view_count: 100, fetched_at: fetchedAt }],
      nextViewCount: 250,
      maxGrowthPerHour: 100,
      multiplier: 10,
    }),
    /absolute limit/
  );
  if (original === undefined) delete process.env.ANOMALY_CHECK_ENABLED;
  else process.env.ANOMALY_CHECK_ENABLED = original;
});

test("campaign transaction intent derives all required program accounts", async () => {
  const creator = "11111111111111111111111111111111";
  const paymentMint = "So11111111111111111111111111111111111111112";
  const result = await buildCreateCampaignIntent(
    {
      campaignId: "42",
      termsHash: "00".repeat(32),
      paymentMint,
      cpmBaseUnits: "2000000",
      maxPayoutPerVideo: "50000000",
      budget: "60000000",
      startTime: 1,
      endTime: 2,
      reviewPeriod: 1,
      appealWindow: 1,
      appealTimeout: 1,
      settlementPeriod: 3,
      maxReportAge: 1,
      finalSnapshotTolerance: 1,
      clockSkewTolerance: 1,
      maxVideosPerClipper: 5,
    },
    creator
  );
  assert.equal(result.transaction.format, "acai-transaction-intent-v1");
  assert.equal(result.transaction.instructions.length, 2);
  assert.equal(result.transaction.instructions[0].args.cpm, "2000000");
  assert.equal(
    result.transaction.instructions[0].accounts.campaign,
    result.campaign
  );
  assert.ok(result.transaction.instructions[1].accounts.vault);
  assert.ok(result.transaction.instructions[1].accounts.creatorTokenAccount);
});

test("campaign activation requires a finalized event matching its intent", () => {
  const intent = {
    creator_wallet: "11111111111111111111111111111111",
    tx_signature: "signature-1",
    campaign_data: {
      budget: "500000000",
      cpm: "2000000",
      max_payout_per_video: "50000000",
      start_time: 100,
      end_time: 200,
    },
  };
  const payload = {
    creator: intent.creator_wallet,
    budget: "500000000",
    cpm: "2000000",
    max_payout_per_video: "50000000",
    start_time: "100",
    end_time: "200",
  };
  assert.doesNotThrow(() =>
    assertCampaignIntentMatchesEvent(intent, payload, "signature-1")
  );
  assert.throws(
    () =>
      assertCampaignIntentMatchesEvent(
        intent,
        { ...payload, budget: "1" },
        "signature-1"
      ),
    /does not match its verified intent/
  );
});

test("submission transaction intent derives submission and stats PDAs", async () => {
  const campaign = "11111111111111111111111111111111";
  const clipper = "So11111111111111111111111111111111111111112";
  const transaction = await buildRegisterSubmissionIntent({
    campaign,
    clipper,
    videoId: "EzoqkJ3blhw",
    termsHash: "00".repeat(32),
  });
  const accounts = transaction.instructions[0].accounts;
  assert.ok(accounts.submission);
  assert.ok(accounts.stats);
  assert.equal(accounts.clipper, clipper);
});

test("claim transaction intent creates the clipper ATA before claim", async () => {
  const campaign = "11111111111111111111111111111111";
  const submission = "So11111111111111111111111111111111111111112";
  const vault = "SysvarRent111111111111111111111111111111111";
  const mint = "Vote111111111111111111111111111111111111111";
  const clipper = "BPFLoaderUpgradeab1e11111111111111111111111";
  const transaction = await buildClaimIntent({
    campaign,
    submission,
    vault,
    mint,
    clipper,
  });
  assert.equal(
    transaction.instructions[0].name,
    "create_associated_token_account_idempotent"
  );
  assert.equal(transaction.instructions[1].name, "claim");
  assert.equal(
    transaction.instructions[0].accounts.associatedToken,
    transaction.instructions[1].accounts.clipperTokenAccount
  );
  assert.equal(transaction.instructions[1].accounts.clipper, clipper);
});

test("chain indexer quarantines rejected business events and continues", async () => {
  const processed = [];
  const deadLetters = [];
  const resolved = [];
  const result = await processDecodedEvents({
    txSignature:
      "signature-for-unit-test-0000000000000000000000000000000000000000",
    events: [
      { eventIndex: 0, eventName: "SubmissionRegistered", payload: {} },
      { eventIndex: 1, eventName: "Claimed", payload: {} },
    ],
    processEvent: async (event) => {
      if (event.eventIndex === 0)
        throw new AppError(409, "SUBMISSION_INTENT_MISSING", "Missing intent");
      processed.push(event.eventIndex);
    },
    recordDeadLetter: async (event) => deadLetters.push(event.eventIndex),
    resolveDeadLetter: async (_signature, eventIndex) =>
      resolved.push(eventIndex),
  });
  assert.deepEqual(result, { processed: 1, quarantined: 1 });
  assert.deepEqual(processed, [1]);
  assert.deepEqual(deadLetters, [0]);
  assert.deepEqual(resolved, [1]);
});

test("chain indexer does not quarantine infrastructure failures", async () => {
  assert.equal(
    isQuarantinableIndexerError(new AppError(409, "INVALID_STATE", "Rejected")),
    true
  );
  assert.equal(
    isQuarantinableIndexerError(new AppError(500, "DATABASE_ERROR", "Failed")),
    false
  );
  assert.equal(
    isQuarantinableIndexerError(new Error("RPC unavailable")),
    false
  );
  await assert.rejects(
    processDecodedEvents({
      txSignature:
        "signature-for-unit-test-1111111111111111111111111111111111111111",
      events: [{ eventIndex: 0, eventName: "Claimed", payload: {} }],
      processEvent: async () => {
        throw new Error("database unavailable");
      },
      recordDeadLetter: async () => {},
      resolveDeadLetter: async () => {},
    }),
    /database unavailable/
  );
});

test("refund transaction intent creates creator ATA and calls refund", async () => {
  const campaign = "11111111111111111111111111111111";
  const creator = "So11111111111111111111111111111111111111112";
  const mint = "Vote111111111111111111111111111111111111111";
  const transaction = await buildRefundIntent({
    campaign,
    creator,
    mint,
  });
  assert.equal(transaction.instructions.length, 2);
  assert.equal(
    transaction.instructions[0].name,
    "create_associated_token_account_idempotent"
  );
  assert.equal(transaction.instructions[1].name, "refund");
  assert.equal(transaction.instructions[1].accounts.creator, creator);
  assert.equal(transaction.instructions[1].accounts.mint, mint);
  assert.ok(transaction.instructions[1].accounts.vault);
});

test("accept and reject submission intents derive stats PDA and creator signer", async () => {
  const campaign = "11111111111111111111111111111111";
  const submission = "So11111111111111111111111111111111111111112";
  const clipper = "BPFLoaderUpgradeab1e11111111111111111111111";
  const creator = "Vote111111111111111111111111111111111111111";

  const accept = await buildAcceptSubmissionIntent({
    campaign,
    submission,
    clipper,
    creator,
  });
  assert.equal(accept.instructions[0].name, "accept_submission");
  assert.equal(accept.instructions[0].accounts.creator, creator);
  assert.ok(accept.instructions[0].accounts.stats);

  const reject = await buildRejectSubmissionIntent({
    campaign,
    submission,
    clipper,
    creator,
    reasonHash: "aa".repeat(32),
  });
  assert.equal(reject.instructions[0].name, "reject_submission");
  assert.equal(reject.instructions[0].accounts.creator, creator);
  assert.equal(reject.instructions[0].args.reason_hash.length, 32);
});
