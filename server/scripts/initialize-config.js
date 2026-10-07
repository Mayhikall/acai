import "dotenv/config";
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
import { estimateAndApplyResourceLimits } from "../src/services/solana-resources.js";

const INITIALIZE_CONFIG_DISCRIMINATOR = new Uint8Array([
  208, 127, 21, 1, 194, 190, 196, 70,
]);
const SYSTEM_PROGRAM = address("11111111111111111111111111111111");
const UPGRADEABLE_LOADER = address(
  "BPFLoaderUpgradeab1e11111111111111111111111"
);
const confirmation = process.argv[process.argv.indexOf("--confirm") + 1];
const send = process.argv.includes("--send");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function loadSigner() {
  const keypairPath = required("ADMIN_KEYPAIR_PATH");
  const stat = await fs.stat(keypairPath);
  if ((stat.mode & 0o077) !== 0)
    throw new Error("ADMIN_KEYPAIR_PATH must have chmod 600");
  const bytes = JSON.parse(await fs.readFile(keypairPath, "utf8"));
  if (
    !Array.isArray(bytes) ||
    bytes.length !== 64 ||
    bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)
  )
    throw new Error("ADMIN_KEYPAIR_PATH must contain a 64-byte keypair");
  const signer = await createKeyPairSignerFromBytes(Uint8Array.from(bytes));
  if (signer.address !== required("ADMIN_WALLET"))
    throw new Error("ADMIN_KEYPAIR_PATH does not match ADMIN_WALLET");
  return signer;
}

function encodeInstruction(admin, oracle) {
  const data = new Uint8Array(72);
  data.set(INITIALIZE_CONFIG_DISCRIMINATOR);
  data.set(getAddressEncoder().encode(admin), 8);
  data.set(getAddressEncoder().encode(oracle), 40);
  return data;
}

async function waitForConfirmation(rpc, signature) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const result = await rpc.getSignatureStatuses([signature]).send();
    const status = result.value[0];
    if (status?.err)
      throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
    if (["confirmed", "finalized"].includes(status?.confirmationStatus)) return;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Timed out waiting for ${signature}`);
}

const rpcUrl = required("SOLANA_RPC_URL");
const program = address(required("VAULT_PROGRAM_ID"));
const programData = address(required("PROGRAM_DATA_ADDRESS"));
const adminAddress = address(required("ADMIN_WALLET"));
const oracle = address(required("ORACLE_REPORTER"));
const rpc = createSolanaRpc(rpcUrl);
const admin = await loadSigner();
const config = (
  await getProgramDerivedAddress({
    programAddress: program,
    seeds: [getBytesEncoder().encode(Buffer.from("config"))],
  })
)[0];

const [programInfo, programDataInfo, configInfo] = await Promise.all([
  rpc.getAccountInfo(program, { encoding: "base64" }).send(),
  rpc.getAccountInfo(programData, { encoding: "base64" }).send(),
  rpc.getAccountInfo(config, { encoding: "base64" }).send(),
]);
if (!programInfo.value || programInfo.value.owner !== UPGRADEABLE_LOADER)
  throw new Error("VAULT_PROGRAM_ID is not a deployed upgradeable program");
if (!programDataInfo.value || programDataInfo.value.owner !== UPGRADEABLE_LOADER)
  throw new Error("PROGRAM_DATA_ADDRESS is invalid");
if (configInfo.value)
  throw new Error(`Config PDA ${config} is already initialized`);

const instruction = {
  programAddress: program,
  accounts: [
    { address: config, role: AccountRole.WRITABLE },
    {
      address: admin.address,
      role: AccountRole.WRITABLE_SIGNER,
      signer: admin,
    },
    {
      address: admin.address,
      role: AccountRole.READONLY_SIGNER,
      signer: admin,
    },
    {
      address: admin.address,
      role: AccountRole.READONLY_SIGNER,
      signer: admin,
    },
    { address: programData, role: AccountRole.READONLY },
    { address: program, role: AccountRole.READONLY },
    { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
  ],
  data: encodeInstruction(adminAddress, oracle),
};
const latest = (
  await rpc.getLatestBlockhash({ commitment: "confirmed" }).send()
).value;
const baseMessage = pipe(
  createTransactionMessage({
    version: Number(process.env.SOLANA_TRANSACTION_VERSION || 1),
  }),
  (value) => setTransactionMessageFeePayerSigner(admin, value),
  (value) => setTransactionMessageLifetimeUsingBlockhash(latest, value),
  (value) => appendTransactionMessageInstruction(instruction, value)
);
const {
  message,
  computeUnitLimit,
  loadedAccountsDataSizeLimit,
} = await estimateAndApplyResourceLimits({ rpc, message: baseMessage });
const transaction = await signTransactionMessageWithSigners(message);
const wire = getBase64EncodedWireTransaction(transaction);
const simulation = await rpc
  .simulateTransaction(wire, {
    commitment: "confirmed",
    encoding: "base64",
    sigVerify: true,
  })
  .send();

console.log({
  cluster: process.env.SOLANA_CLUSTER || "devnet",
  rpcUrl,
  program,
  programData,
  config,
  payer: admin.address,
  admin: adminAddress,
  oracle,
  transactionVersion: Number(process.env.SOLANA_TRANSACTION_VERSION || 1),
  computeUnitLimit,
  loadedAccountsDataSizeLimit,
  simulationError: simulation.value.err,
  unitsConsumed: simulation.value.unitsConsumed?.toString() ?? null,
});
if (simulation.value.logs?.length) console.log(simulation.value.logs.join("\n"));
if (simulation.value.err)
  throw new Error("initialize_config simulation failed");

if (!send) {
  console.log("\nSimulation passed. No transaction was sent.");
  console.log(
    `After review, send with: npm run init:config -- --send --confirm ${config}`
  );
  process.exit(0);
}
if (confirmation !== config)
  throw new Error(
    `Sending requires --confirm ${config}; rerun simulation and review first`
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
console.log(`initialize_config confirmed: ${signature}`);
