import "dotenv/config";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import bs58 from "bs58";
import nacl from "tweetnacl";

const port = Number(process.env.E2E_PORT || 4010);
const origin = `http://127.0.0.1:${port}`;
const internalSecret = `e2e-${crypto.randomBytes(24).toString("hex")}`;
const reporter = bs58.encode(nacl.sign.keyPair().publicKey);
const paymentMint = bs58.encode(nacl.sign.keyPair().publicKey);
const fixturePath = path.join(
  os.tmpdir(),
  `acai-youtube-e2e-${crypto.randomUUID()}.json`
);
let server;
let serverLog = "";

function fail(label, response, body) {
  const logs = serverLog
    ? `\nLast server logs:\n${serverLog.slice(-4000)}`
    : "";
  throw new Error(
    `${label} failed (${response.status}): ${JSON.stringify(body)}${logs}`
  );
}

async function request(path, options = {}) {
  const response = await fetch(`${origin}${path}`, options);
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { response, body };
}

function json(body, token, internal = false) {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(internal ? { "x-internal-secret": internalSecret } : {}),
    },
    body: JSON.stringify(body),
  };
}

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const health = await request("/health");
      if (health.response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Backend did not become ready at ${origin}`);
}

async function authenticate() {
  const keypair = nacl.sign.keyPair();
  const wallet = bs58.encode(keypair.publicKey);
  const nonce = await request("/auth/nonce", json({ wallet }));
  if (!nonce.response.ok) fail("Request nonce", nonce.response, nonce.body);
  const signature = bs58.encode(
    nacl.sign.detached(Buffer.from(nonce.body.message), keypair.secretKey)
  );
  const verified = await request(
    "/auth/verify",
    json({ wallet, signature, message: nonce.body.message })
  );
  if (!verified.response.ok)
    fail("Verify wallet", verified.response, verified.body);
  return { wallet, token: verified.body.token };
}

function fakeSignature(label) {
  return `${label}-${crypto.randomBytes(32).toString("hex")}`;
}

async function indexEvent(eventName, payload) {
  const result = await request(
    "/internal/indexer/events",
    json(
      {
        txSignature: fakeSignature(eventName),
        eventIndex: 0,
        eventName,
        payload,
      },
      null,
      true
    )
  );
  if (!result.response.ok)
    fail(`Index ${eventName}`, result.response, result.body);
  return result.body;
}

async function run() {
  const channelId = `UC_E2E_${crypto.randomBytes(8).toString("hex")}`;
  await writeFile(
    fixturePath,
    JSON.stringify({
      channel: {
        channelId,
        title: "Acai E2E Clipper",
        subscriberCount: 2500,
        channelCreatedAt: "2023-01-01T00:00:00.000Z",
      },
      videos: [
        {
          videoId: "dQw4w9WgXcQ",
          channelId,
          title: "Acai E2E clip",
          description: "A short clip mentioning @acai_creator_podcast",
          publishedAtOffsetSeconds: -3600,
          durationSeconds: 58,
          availability: "public",
          viewCount: 1000,
        },
      ],
    })
  );
  server = spawn(process.execPath, ["src/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      API_ORIGIN: origin,
      YOUTUBE_ADAPTER: "mock",
      YOUTUBE_MOCK_FIXTURE: fixturePath,
      INTERNAL_API_SECRET: internalSecret,
      ORACLE_REPORTER: reporter,
      ORACLE_SUBMIT_ENABLED: "false",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      CLAIM_REQUEST_COOLDOWN_SECONDS: "0",
      ANOMALY_CHECK_ENABLED: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => {
    serverLog += chunk.toString();
  });
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await waitForServer();

  const creator = await authenticate();
  const clipper = await authenticate();
  console.log("✓ creator and clipper authenticated with temporary wallets");

  const connected = await request("/youtube/connect", {
    headers: { authorization: `Bearer ${clipper.token}` },
  });
  if (!connected.response.ok)
    fail("Connect mock YouTube", connected.response, connected.body);
  console.log("✓ mock YouTube channel connected");

  const now = Math.floor(Date.now() / 1000);
  const form = new FormData();
  const fields = {
    title: `E2E Campaign ${Date.now()}`,
    brief: "Automated local backend smoke test",
    sourceVideo: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    requiredMention: "@acai_creator_podcast",
    paymentMint,
    cpmBaseUnits: "1000000",
    maxPayoutPerVideo: "5000000",
    budget: "10000000",
    startTime: String(now - 7200),
    endTime: String(now + 3600),
    reviewPeriod: "300",
    appealWindow: "300",
    appealTimeout: "300",
    settlementPeriod: "1200",
    maxReportAge: "300",
    finalSnapshotTolerance: "300",
    clockSkewTolerance: "30",
    maxVideosPerClipper: "5",
  };
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append(
    "terms",
    new Blob(["%PDF-1.4\n% Acai local E2E terms\n%%EOF\n"], {
      type: "application/pdf",
    }),
    "terms.pdf"
  );
  const created = await request("/campaigns", {
    method: "POST",
    headers: { authorization: `Bearer ${creator.token}` },
    body: form,
  });
  if (!created.response.ok)
    fail("Create campaign", created.response, created.body);
  const campaign = created.body.campaign;
  if (created.body.transaction?.instructions?.length !== 2)
    throw new Error("Campaign transaction intent is incomplete");
  console.log(`✓ campaign ${campaign.id} created with transaction intent`);

  await indexEvent("CampaignFunded", {
    campaign_id: campaign.id,
    amount: campaign.budget,
  });
  console.log("✓ simulated CampaignFunded event indexed");

  const submitted = await request(
    `/campaigns/${campaign.id}/submissions`,
    json({ videoId: "dQw4w9WgXcQ" }, clipper.token)
  );
  if (!submitted.response.ok)
    fail("Create submission intent", submitted.response, submitted.body);
  const onchainSubmission =
    submitted.body.transaction.instructions[0].accounts.submission;
  console.log(
    "✓ video ownership, duration, publish time, and mention verified"
  );

  const registered = await indexEvent("SubmissionRegistered", {
    campaign_id: campaign.id,
    video_id: "dQw4w9WgXcQ",
    clipper: clipper.wallet,
    submission: onchainSubmission,
    submitted_at: now,
    review_deadline: now + 300,
  });
  const submissionId = registered.submissionId;
  console.log(`✓ submission ${submissionId} registered and baseline requested`);

  await indexEvent("OracleReportSubmitted", {
    submission: onchainSubmission,
    report_seq: "1",
    view_count: "1000",
    fetched_at: now,
    is_final: false,
    is_baseline: true,
    reporter,
  });
  await indexEvent("SubmissionAccepted", {
    submission: onchainSubmission,
    accepted_at: now,
  });
  console.log("✓ baseline confirmed and submission accepted");

  const views = await request(
    "/internal/mock/videos/dQw4w9WgXcQ/views",
    json({ views: 2500 }, null, true)
  );
  if (!views.response.ok) fail("Update mock views", views.response, views.body);
  const oracle = await request(
    "/internal/oracle/run",
    json({ submissionId }, null, true)
  );
  if (!oracle.response.ok) fail("Run oracle", oracle.response, oracle.body);
  await indexEvent("OracleReportSubmitted", {
    submission: onchainSubmission,
    report_seq: "2",
    view_count: "2500",
    fetched_at: now + 1,
    is_final: false,
    is_baseline: false,
    reporter,
  });
  console.log("✓ view growth collected and oracle report confirmed");

  const claim = await request(
    `/submissions/${submissionId}/claim-request`,
    json({}, clipper.token)
  );
  if (!claim.response.ok) fail("Request claim", claim.response, claim.body);
  if (claim.body.claimRequest.status !== "READY" || !claim.body.transaction)
    throw new Error("Claim request did not produce a READY transaction intent");
  const amount = claim.body.amount.remaining;
  console.log(`✓ claim intent ready for ${amount} base units`);

  await indexEvent("Claimed", {
    submission: onchainSubmission,
    amount,
    remaining_claim: "0",
  });
  const claims = await request(`/submissions/${submissionId}/claims`, {
    headers: { authorization: `Bearer ${clipper.token}` },
  });
  if (!claims.response.ok || claims.body.claims.length !== 1)
    fail("Verify indexed claim", claims.response, claims.body);
  console.log("✓ claim confirmation indexed and persisted");

  await request("/youtube/channel", {
    method: "DELETE",
    headers: { authorization: `Bearer ${clipper.token}` },
  });
  console.log("\nBackend E2E passed (off-chain + simulated indexer events).");
  console.log("No Solana transaction was signed or sent.");
}

try {
  await run();
} finally {
  if (server && !server.killed) {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      server.once("exit", resolve);
      setTimeout(resolve, 2_000).unref();
    });
  }
  await unlink(fixturePath).catch(() => {});
}
