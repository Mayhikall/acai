Documentation: [Backend API](docs/BACKEND.md) · [Environment variables](docs/ENVIRONMENT.md)

# Acai backend

JavaScript/ESM backend for the flows in `PRD.MD`: wallet authentication, YouTube OAuth and verification, campaign terms, submission intents, claim orchestration, oracle snapshots/holds, idempotent on-chain event ingestion, notifications, and the devnet faucet.

## Setup

Requirements: Node.js 20.18+ and PostgreSQL.

```bash
cp .env.example .env
npm ci
npm run migrate
npm run seed       # development demo data only
npm run dev
```

Use `npm test` for domain tests. `npm run migrate:rollback` rolls back the schema.

## Real and mock YouTube data

Set `YOUTUBE_ADAPTER=api` for Google OAuth/Data API or `YOUTUBE_ADAPTER=mock` for the demo adapter.

These are intentionally separate:

- Relational demo records belong in `src/db/seeds/001_demo.js`.
- Fake responses from an external API are fixtures, so YouTube video/channel data lives in `src/db/fixtures/youtube-videos.json`.
- Adapter classes contain behavior only; no demo record is hardcoded in production service code.

The real adapter obtains the authenticated channel and its uploads playlist with `channels.list`, lists playlist entries with `playlistItems.list`, and batches full video metadata/statistics through `videos.list` (up to 50 IDs).

## Terms storage

Production requires Supabase credentials and stores PDFs in the private `campaign-terms` bucket. Development can use the ignored `uploads/` directory. The API returns a five-minute signed URL in production.

## On-chain synchronization

User-owned transactions are never signed by this API. Campaign, submission, and claim endpoints return an `acai-transaction-intent-v1` payload containing the program ID, transaction version, instruction arguments, and complete account/PDA maps. The frontend builds and asks the user wallet to sign those transactions.

Submission verification creates a 30-minute `submission_intent`; `POST /internal/indexer/events` is the authenticated webhook for decoded Anchor events. It updates the database idempotently by `(tx_signature, event_index)` and triggers the baseline after `SubmissionRegistered`.

The oracle submitter is built into the worker but is opt-in. It reads `ORACLE_KEYPAIR_PATH`, refuses permissive file modes, checks `ORACLE_REPORTER`, simulates every report transaction, sends it, waits for confirmation, and retries failures with exponential backoff. No keypair is included in this repository. Keep `ORACLE_SUBMIT_ENABLED=false` until the devnet program/config are initialized and the oracle account is funded.

Set `WORKERS_ENABLED=true` and `ORACLE_WORKER_ENABLED=true` to run periodic snapshots, final reports, retries, notification reminders, and retention cleanup. All `/internal/*` routes require `x-internal-secret`; `/internal/maintenance/run` runs one cycle manually.

## Useful endpoints

- `/auth/*`: nonce, verification, logout, current user
- `/youtube/*`: connect, callback, own videos, revoke
- `/campaigns/*`: create/list/detail/terms and submissions
- `/submissions/*`: detail, review notes, claim requests/history
- `/me/*`: in-app notifications
- `/internal/oracle/*`: run worker and resolve held reports
- `/internal/indexer/events`: authenticated webhook for decoded Anchor events
- `/internal/maintenance/run`: run one worker cycle manually
- `/faucet`: fixed 1,000 aUSDC devnet mint

Amounts and campaign IDs are returned/stored as decimal strings where JavaScript number precision would be unsafe. Campaign creation accepts CPM as cpmBaseUnits: for a 6-decimal token, 2 tokens per 1,000 views is 2000000. The submitted paymentMint must equal AUSDC_MINT_ADDRESS.

## Local backend end-to-end smoke test

With PostgreSQL running and migrations applied, run:

```bash
npm run test:e2e
```

This starts an isolated API process on port `4010`, uses the mock YouTube
adapter, and exercises wallet authentication, campaign creation, submission
verification, oracle reports, and claims. On-chain confirmations are represented
by authenticated indexer events; the script does not sign or send a Solana
transaction.

## Finalized chain indexer

Set `CHAIN_INDEXER_ENABLED=true` to poll finalized transactions for `VAULT_PROGRAM_ID`, decode Anchor events using `src/idl/vault.json`, and apply them idempotently through the existing PostgreSQL indexer. On its first start it records the current finalized head by default; set `CHAIN_INDEXER_BACKFILL_ON_START=true` only when historical transactions have matching backend intents/data. The cursor persists per cluster and program in `indexer_cursor`, and failures retry with exponential backoff. `CHAIN_INDEXER_MAX_PAGES` caps each backlog scan.

Indexer events rejected with a 4xx domain error (for example, an on-chain submission without a matching backend intent) are quarantined in `indexer_dead_letters`; the finalized checkpoint continues so one poison event cannot block the stream. Database, RPC, decoder, and other infrastructure failures still stop the cycle and retry without advancing that transaction. Operators can inspect unresolved items with `GET /internal/indexer/dead-letters` and retry one after repairing its dependency with `POST /internal/indexer/dead-letters/:signature/:eventIndex/retry`.
