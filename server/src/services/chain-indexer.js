import fs from "node:fs";
import path from "node:path";
import { BorshCoder, EventParser } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { db } from "../db/index.js";
import { AppError } from "../lib/errors.js";
import { processIndexerEvent } from "./indexer.js";

const PAGE_SIZE = 1000;
let timer;
let running = false;

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required when chain indexer is enabled`);
  return value;
}

function normalize(value) {
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return [...value];
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value.toBase58 === "function") return value.toBase58();
  if (typeof value.toString === "function" && value.constructor?.name === "BN") return value.toString(10);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  throw new TypeError(`Unsupported event value type: ${typeof value}`);
}

function loadIdl() {
  const configured = process.env.VAULT_IDL_PATH;
  const filename = configured
    ? path.resolve(configured)
    : path.resolve(process.cwd(), "src/idl/vault.json");
  const idl = JSON.parse(fs.readFileSync(filename, "utf8"));
  if (idl.address !== required("VAULT_PROGRAM_ID"))
    throw new Error("VAULT_IDL_PATH address does not match VAULT_PROGRAM_ID");
  return idl;
}

export function createEventDecoder({ idl = loadIdl(), programId = required("VAULT_PROGRAM_ID") } = {}) {
  const parser = new EventParser(new PublicKey(programId), new BorshCoder(idl));
  return (logs = []) => [...parser.parseLogs(logs)].map((event, eventIndex) => ({
    eventIndex,
    eventName: event.name,
    payload: normalize(event.data),
  }));
}

async function cursorId() {
  return `vault:${required("SOLANA_CLUSTER")}:${required("VAULT_PROGRAM_ID")}`;
}

async function getCursor() {
  const id = await cursorId();
  return db("indexer_cursor").where({ id }).first();
}

async function saveCursor(signature, slot, error = null) {
  const id = await cursorId();
  const common = {
    last_signature: signature,
    last_slot: String(slot),
    last_error: error ? String(error.message || error).slice(0, 4000) : null,
    updated_at: db.fn.now(),
  };
  if (error) {
    await db("indexer_cursor")
      .insert({ id, ...common, consecutive_failures: 1 })
      .onConflict("id")
      .merge({ ...common, consecutive_failures: db.raw("indexer_cursor.consecutive_failures + 1") });
  } else {
    await db("indexer_cursor")
      .insert({ id, ...common, consecutive_failures: 0 })
      .onConflict("id")
      .merge({ ...common, consecutive_failures: 0 });
  }
}

async function seedAtHead(connection) {
  const program = new PublicKey(required("VAULT_PROGRAM_ID"));
  const [head] = await connection.getSignaturesForAddress(program, { limit: 1 }, "finalized");
  await saveCursor(head?.signature ?? null, head?.slot ?? 0);
  return { seeded: true, signature: head?.signature ?? null, slot: head?.slot ?? null };
}

async function collectNewSignatures(connection, lastSignature) {
  const program = new PublicKey(required("VAULT_PROGRAM_ID"));
  const maxPages = Math.max(1, Number(process.env.CHAIN_INDEXER_MAX_PAGES || 10));
  const collected = [];
  let before;
  for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
    const options = { limit: PAGE_SIZE };
    if (before) options.before = before;
    if (lastSignature) options.until = lastSignature;
    const page = await connection.getSignaturesForAddress(program, options, "finalized");
    collected.push(...page);
    if (page.length < PAGE_SIZE) return collected.reverse();
    before = page.at(-1).signature;
  }
  throw new Error(`Indexer backlog exceeds ${maxPages * PAGE_SIZE} transactions; increase CHAIN_INDEXER_MAX_PAGES`);
}

export function isQuarantinableIndexerError(error) {
  return error instanceof AppError && error.status >= 400 && error.status < 500;
}

export async function recordIndexerDeadLetter(event, error) {
  const row = {
    tx_signature: event.txSignature,
    event_index: event.eventIndex,
    event_name: event.eventName,
    payload: event.payload,
    error_code: error.code || "INDEXER_EVENT_REJECTED",
    error_message: String(error.message || error).slice(0, 4000),
    last_seen_at: db.fn.now(),
    resolved_at: null,
  };
  await db("indexer_dead_letters")
    .insert(row)
    .onConflict(["tx_signature", "event_index"])
    .merge({ ...row, attempts: db.raw("indexer_dead_letters.attempts + 1") });
}

async function resolveIndexerDeadLetter(txSignature, eventIndex) {
  await db("indexer_dead_letters")
    .where({ tx_signature: txSignature, event_index: eventIndex })
    .update({ resolved_at: db.fn.now(), last_seen_at: db.fn.now() });
}

export async function retryIndexerDeadLetter(txSignature, eventIndex) {
  const row = await db("indexer_dead_letters")
    .where({ tx_signature: txSignature, event_index: eventIndex })
    .first();
  if (!row) throw new AppError(404, "DEAD_LETTER_NOT_FOUND", "Indexer dead letter not found");
  const event = { txSignature: row.tx_signature, eventIndex: row.event_index, eventName: row.event_name, payload: row.payload };
  try {
    const result = await processIndexerEvent(event);
    await resolveIndexerDeadLetter(txSignature, eventIndex);
    return result;
  } catch (error) {
    await recordIndexerDeadLetter(event, error);
    throw error;
  }
}

export async function processDecodedEvents({ txSignature, events, processEvent = processIndexerEvent, recordDeadLetter = recordIndexerDeadLetter, resolveDeadLetter = resolveIndexerDeadLetter }) {
  let processed = 0;
  let quarantined = 0;
  for (const event of events) {
    const input = { txSignature, ...event };
    try {
      await processEvent(input);
      await resolveDeadLetter(txSignature, event.eventIndex);
      processed += 1;
    } catch (error) {
      await recordDeadLetter(input, error);
      if (!isQuarantinableIndexerError(error)) throw error;
      quarantined += 1;
    }
  }
  return { processed, quarantined };
}

export async function runChainIndexerCycle({ logger = console } = {}) {
  if (running) return { skipped: "already-running" };
  running = true;
  try {
    const connection = new Connection(required("SOLANA_RPC_URL"), "finalized");
    const decode = createEventDecoder();
    let cursor = await getCursor();
    if (!cursor) {
      if (process.env.CHAIN_INDEXER_BACKFILL_ON_START !== "true") return await seedAtHead(connection);
      const id = await cursorId();
      await db("indexer_cursor").insert({ id }).onConflict("id").ignore();
      cursor = await getCursor();
    }
    const signatures = await collectNewSignatures(connection, cursor.last_signature);
    let eventCount = 0;
    let quarantinedCount = 0;
    for (const item of signatures) {
      if (!item.err) {
        const transaction = await connection.getTransaction(item.signature, {
          commitment: "finalized",
          maxSupportedTransactionVersion: 1,
        });
        if (!transaction) throw new Error(`Finalized transaction unavailable: ${item.signature}`);
        const events = decode(transaction.meta?.logMessages ?? []);
        const outcome = await processDecodedEvents({ txSignature: item.signature, events });
        eventCount += outcome.processed;
        quarantinedCount += outcome.quarantined;
      }
      await saveCursor(item.signature, item.slot);
    }
    return { transactions: signatures.length, events: eventCount, quarantined: quarantinedCount, slot: signatures.at(-1)?.slot ?? cursor.last_slot };
  } catch (error) {
    const cursor = await getCursor().catch(() => null);
    await saveCursor(cursor?.last_signature ?? null, cursor?.last_slot ?? 0, error).catch(() => {});
    logger.error?.({ err: error }, "Chain indexer cycle failed");
    throw error;
  } finally {
    running = false;
  }
}

export function startChainIndexer(logger = console) {
  if (process.env.CHAIN_INDEXER_ENABLED !== "true") return () => {};
  const baseInterval = Math.max(Number(process.env.CHAIN_INDEXER_INTERVAL_SECONDS || 5) * 1000, 1000);
  let stopped = false;
  const execute = async () => {
    if (stopped) return;
    let delay = baseInterval;
    try {
      await runChainIndexerCycle({ logger });
    } catch {
      const failures = Number((await getCursor().catch(() => null))?.consecutive_failures || 1);
      delay = Math.min(baseInterval * 2 ** Math.min(failures, 6), 300_000);
    }
    if (!stopped) {
      timer = setTimeout(execute, delay);
      timer.unref();
    }
  };
  execute();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
}
