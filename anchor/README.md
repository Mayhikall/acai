# Acai Vault Program

This program is the core smart contract for **Acai**, a decentralized clipping campaign platform built with [Anchor](https://www.anchor-lang.com/).

Unlike a simple storage vault, the Acai Vault acts as a trustless escrow that secures Creator funds (aUSDC) and guarantees automated payouts to Clippers based on verified YouTube views reported by the Oracle.

## Pre-deployed Program

The Acai vault program is actively deployed on **devnet** at:

```
5qjmvHtiiMPS4U9HsodyUhMw297WsRmSpqeesEZgcupy
```

You can interact with it using the Next.js frontend or backend oracle worker.

## Program Overview

The Acai smart contract manages the lifecycle of performance-based marketing campaigns:

- **Campaign Initialization**: Creators define payout terms (CPM, max payout, deadlines) and lock aUSDC budget into a campaign-specific Vault PDA.
- **Submission Registry**: Clippers register their YouTube video IDs. The program records baseline views to prevent gaming the system.
- **Review & Appeal**: Creators can accept or reject submissions on-chain.
- **Oracle Synchronization**: A backend Node.js Oracle fetches views from YouTube API and submits them trustlessly to `OracleReport` PDAs.
- **Trustless Claim**: Clippers claim payouts directly from the contract. Payouts are mathematically calculated on-chain `(views * CPM)` without relying on backend servers for fund transfer.

## Deploying Your Own Program

To deploy your own version of the program to a different cluster or for local development:

### 1. Generate a new program keypair

```bash
cd anchor
solana-keygen new -o target/deploy/vault-keypair.json
```

### 2. Get the new program ID

```bash
solana address -k target/deploy/vault-keypair.json
```

### 3. Update the program ID

Update the program ID in these files:

- `anchor/Anchor.toml` - Update `vault = "..."` under `[programs.devnet]`
- `anchor/programs/vault/src/lib.rs` - Update `declare_id!("...")`
- `server/.env` - Update `VAULT_PROGRAM_ID=...`

### 4. Build and deploy

```bash
# Build the program
anchor build

# Get devnet SOL for deployment (~2-3 SOL needed)
solana airdrop 2 --url devnet

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### 5. Regenerate the TypeScript client

```bash
cd ..
npm run codama:js
```

This updates the generated client code in `app/generated/vault/` with your new program ID for the frontend to consume.

## Testing

Run the Anchor test suite (ensure your local solana-test-validator is ready or let anchor spin it up):

```bash
anchor test --skip-deploy
```
