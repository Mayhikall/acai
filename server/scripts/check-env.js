import "dotenv/config";
import fs from "node:fs/promises";
import { PublicKey } from "@solana/web3.js";

const errors = [];
const warnings = [];
const enabled = [];
const required = (name, reason) => {
  if (!process.env[name]) errors.push(`${name}: wajib ${reason}`);
};
const bool = (name) => {
  const value = process.env[name];
  if (value != null && !["true", "false"].includes(value))
    errors.push(`${name}: harus true atau false`);
  return value === "true";
};
const validUrl = (name) => {
  if (!process.env[name]) return;
  try {
    new URL(process.env[name]);
  } catch {
    errors.push(`${name}: URL tidak valid`);
  }
};
const validPublicKey = (name) => {
  if (!process.env[name]) return;
  try {
    new PublicKey(process.env[name]);
  } catch {
    errors.push(`${name}: bukan Solana public key yang valid`);
  }
};

for (const name of [
  "NODE_ENV", "PORT", "APP_ORIGIN", "API_ORIGIN",
  "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME",
  "JWT_SECRET", "INTERNAL_API_SECRET", "TOKEN_ENCRYPTION_KEY",
  "YOUTUBE_ADAPTER", "SOLANA_CLUSTER", "SOLANA_RPC_URL",
  "SOLANA_TRANSACTION_VERSION", "VAULT_PROGRAM_ID", "AUSDC_MINT_ADDRESS",
]) required(name, "untuk runtime backend");

if (![
  "development", "test", "production",
].includes(process.env.NODE_ENV)) errors.push("NODE_ENV: gunakan development, test, atau production");
for (const name of ["APP_ORIGIN", "API_ORIGIN", "SOLANA_RPC_URL"]) validUrl(name);
for (const name of ["VAULT_PROGRAM_ID", "AUSDC_MINT_ADDRESS", "ORACLE_REPORTER", "ADMIN_WALLET", "PROGRAM_DATA_ADDRESS"])
  validPublicKey(name);
if ((process.env.JWT_SECRET || "").length < 32) errors.push("JWT_SECRET: minimum 32 karakter random");
if ((process.env.INTERNAL_API_SECRET || "").length < 32) errors.push("INTERNAL_API_SECRET: minimum 32 karakter random");
try {
  if (Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || "", "base64").length !== 32)
    errors.push("TOKEN_ENCRYPTION_KEY: harus tepat 32 byte dalam base64");
} catch {
  errors.push("TOKEN_ENCRYPTION_KEY: base64 tidak valid");
}

const youtube = process.env.YOUTUBE_ADAPTER;
if (youtube === "api") {
  enabled.push("YouTube API + OAuth");
  for (const name of ["YOUTUBE_API_KEY", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"])
    required(name, "saat YOUTUBE_ADAPTER=api");
  validUrl("GOOGLE_REDIRECT_URI");
} else if (youtube === "mock") {
  enabled.push("YouTube mock fixture");
  required("YOUTUBE_MOCK_FIXTURE", "saat YOUTUBE_ADAPTER=mock");
} else {
  errors.push("YOUTUBE_ADAPTER: harus api atau mock");
}

const chainIndexer = bool("CHAIN_INDEXER_ENABLED");
const oracleSubmit = bool("ORACLE_SUBMIT_ENABLED");
const oracleWorker = bool("ORACLE_WORKER_ENABLED");
const workers = bool("WORKERS_ENABLED");
bool("CHAIN_INDEXER_BACKFILL_ON_START");
bool("ANOMALY_CHECK_ENABLED");
if (chainIndexer) enabled.push("Finalized chain indexer");
if (workers) enabled.push("Maintenance workers");
if (oracleSubmit) {
  enabled.push("On-chain oracle submitter");
  for (const name of ["ORACLE_REPORTER", "ORACLE_KEYPAIR_PATH"])
    required(name, "saat ORACLE_SUBMIT_ENABLED=true");
  if (process.env.ORACLE_KEYPAIR_PATH) {
    try {
      const stat = await fs.stat(process.env.ORACLE_KEYPAIR_PATH);
      if ((stat.mode & 0o077) !== 0) errors.push("ORACLE_KEYPAIR_PATH: jalankan chmod 600");
    } catch {
      errors.push("ORACLE_KEYPAIR_PATH: file tidak ditemukan");
    }
  }
}
if (oracleWorker && !workers)
  warnings.push("ORACLE_WORKER_ENABLED=true tidak berjalan karena WORKERS_ENABLED=false");
if (process.env.NODE_ENV === "production" && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY))
  errors.push("Production membutuhkan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY untuk terms PDF");
if (process.env.CHAIN_INDEXER_BACKFILL_ON_START === "true")
  warnings.push("CHAIN_INDEXER_BACKFILL_ON_START=true berisiko membuat dead-letter dari history tanpa backend intent");

console.log("Environment profile:");
for (const item of enabled) console.log(`  ✓ ${item}`);
for (const item of warnings) console.warn(`  ! ${item}`);
if (errors.length) {
  console.error("\nEnvironment invalid:");
  for (const item of errors) console.error(`  ✗ ${item}`);
  process.exitCode = 1;
} else {
  console.log("\n✓ Environment valid (secret values were not printed)");
}
