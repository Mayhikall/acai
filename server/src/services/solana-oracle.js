import bs58 from "bs58";
import fs from "node:fs/promises";
import {
  AccountRole,
  address,
  appendTransactionMessageInstruction,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getAddressEncoder,
  getBase64EncodedWireTransaction,
  getBytesEncoder,
  getProgramDerivedAddress,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { estimateAndApplyResourceLimits } from "./solana-resources.js";

const SYSTEM_PROGRAM = address("11111111111111111111111111111111");
const SUBMIT_REPORT_DISCRIMINATOR = new Uint8Array([
  141, 255, 247, 6, 153, 214, 17, 103,
]);
let cachedSigner;
let cachedSignerPath;

export function oracleSubmitEnabled() {
  return process.env.ORACLE_SUBMIT_ENABLED === "true";
}

function required(name) {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is required when oracle submit is enabled`);
  return value;
}

function rpcClient() {
  return createSolanaRpc(required("SOLANA_RPC_URL"));
}

async function loadOracleSigner() {
  if (cachedSigner) return cachedSigner;
  let parsed;
  const secret = process.env.ORACLE_KEYPAIR_SECRET;
  if (secret) {
    const raw = secret.trim();
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = Array.from(bs58.decode(raw));
    }
  } else {
    const keypairPath = required("ORACLE_KEYPAIR_PATH");
    const stat = await fs.stat(keypairPath);
    if ((stat.mode & 0o077) !== 0)
      throw new Error(
        "ORACLE_KEYPAIR_PATH must not be readable by group or others (chmod 600)"
      );
    parsed = JSON.parse(await fs.readFile(keypairPath, "utf8"));
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 64 ||
    parsed.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)
  )
    throw new Error(
      "Oracle keypair must contain a Solana 64-byte keypair JSON array"
    );
  cachedSigner = await createKeyPairSignerFromBytes(Uint8Array.from(parsed));
  if (
    process.env.ORACLE_REPORTER &&
    process.env.ORACLE_REPORTER !== cachedSigner.address
  )
    throw new Error("ORACLE_REPORTER does not match Oracle keypair");
  process.env.ORACLE_REPORTER = cachedSigner.address;
  return cachedSigner;
}

function encodeSubmitReport({ viewCount, fetchedAt, isFinal }) {
  const data = new Uint8Array(25);
  data.set(SUBMIT_REPORT_DISCRIMINATOR, 0);
  const view = new DataView(data.buffer);
  view.setBigUint64(8, BigInt(viewCount), true);
  view.setBigInt64(16, BigInt(fetchedAt), true);
  data[24] = isFinal ? 1 : 0;
  return data;
}

async function derivePda(programAddress, label, extraAddress) {
  const seeds = [getBytesEncoder().encode(Buffer.from(label))];
  if (extraAddress)
    seeds.push(getAddressEncoder().encode(address(extraAddress)));
  return (await getProgramDerivedAddress({ programAddress, seeds }))[0];
}

async function waitForConfirmation(rpc, signature, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await rpc.getSignatureStatuses([signature]).send();
    const status = result.value[0];
    if (status?.err)
      throw new Error(
        `Oracle transaction failed: ${JSON.stringify(status.err)}`
      );
    if (["confirmed", "finalized"].includes(status?.confirmationStatus)) return;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Timed out waiting for oracle transaction ${signature}`);
}

export async function getOracleReporter() {
  if (oracleSubmitEnabled()) return (await loadOracleSigner()).address;
  return process.env.ORACLE_REPORTER || "unconfigured";
}

export async function getSafeOracleTimestamp(sourceTime) {
  const sourceSeconds = Math.floor(new Date(sourceTime).getTime() / 1000);
  if (!oracleSubmitEnabled()) return sourceSeconds;
  const rpc = rpcClient();
  const slot = await rpc.getSlot({ commitment: "confirmed" }).send();
  const chainTime = await rpc.getBlockTime(slot).send();
  return chainTime == null
    ? sourceSeconds
    : Math.min(sourceSeconds, Number(chainTime));
}

export async function submitOracleReportOnchain({
  campaign,
  submission,
  viewCount,
  fetchedAt,
  isFinal,
}) {
  if (!oracleSubmitEnabled()) return null;
  if (!campaign || !submission)
    throw new Error(
      "Both on-chain campaign and submission addresses are required"
    );

  const rpc = rpcClient();
  const oracle = await loadOracleSigner();
  const programAddress = address(required("VAULT_PROGRAM_ID"));
  const config = await derivePda(programAddress, "config");
  const report = await derivePda(programAddress, "report", submission);
  const instruction = {
    programAddress,
    accounts: [
      { address: config, role: AccountRole.READONLY },
      { address: address(campaign), role: AccountRole.READONLY },
      { address: address(submission), role: AccountRole.WRITABLE },
      { address: report, role: AccountRole.WRITABLE },
      {
        address: oracle.address,
        role: AccountRole.WRITABLE_SIGNER,
        signer: oracle,
      },
      { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
    ],
    data: encodeSubmitReport({ viewCount, fetchedAt, isFinal }),
  };
  const latest = (
    await rpc.getLatestBlockhash({ commitment: "confirmed" }).send()
  ).value;
  const baseMessage = pipe(
    createTransactionMessage({
      version: Number(process.env.SOLANA_TRANSACTION_VERSION || 1),
    }),
    (value) => setTransactionMessageFeePayerSigner(oracle, value),
    (value) => setTransactionMessageLifetimeUsingBlockhash(latest, value),
    (value) => appendTransactionMessageInstruction(instruction, value)
  );
  const { message } = await estimateAndApplyResourceLimits({
    rpc,
    message: baseMessage,
  });
  const transaction = await signTransactionMessageWithSigners(message);
  const wire = getBase64EncodedWireTransaction(transaction);
  const simulation = await rpc
    .simulateTransaction(wire, {
      commitment: "confirmed",
      encoding: "base64",
      sigVerify: true,
    })
    .send();
  if (simulation.value.err)
    throw new Error(
      `Oracle transaction simulation failed: ${JSON.stringify(simulation.value.err)}; logs=${JSON.stringify(simulation.value.logs ?? [])}`
    );
  const signature = await rpc
    .sendTransaction(wire, {
      encoding: "base64",
      preflightCommitment: "confirmed",
      skipPreflight: false,
      maxRetries: 3n,
    })
    .send();
  await waitForConfirmation(rpc, signature);
  return signature;
}
