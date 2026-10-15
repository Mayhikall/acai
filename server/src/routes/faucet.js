import fs from "node:fs/promises";
import { Router } from "express";
import bs58 from "bs58";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { db } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError, asyncHandler } from "../lib/errors.js";

const router = Router();

async function loadFaucetKeypair() {
  const secret = process.env.FAUCET_KEYPAIR_SECRET;
  if (secret) {
    const raw = secret.trim();
    try {
      const parsed = JSON.parse(raw);
      return Keypair.fromSecretKey(Uint8Array.from(parsed));
    } catch {
      return Keypair.fromSecretKey(bs58.decode(raw));
    }
  }
  const keypairPath = process.env.FAUCET_KEYPAIR_PATH;
  if (keypairPath) {
    const raw = await fs.readFile(keypairPath, "utf8");
    const parsed = JSON.parse(raw);
    return Keypair.fromSecretKey(Uint8Array.from(parsed));
  }
  return null;
}

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!process.env.AUSDC_MINT_ADDRESS)
      throw new AppError(
        503,
        "FAUCET_NOT_CONFIGURED",
        "Faucet mint is not configured"
      );
    if ((process.env.SOLANA_CLUSTER || "devnet") !== "devnet")
      throw new AppError(
        403,
        "FAUCET_DEVNET_ONLY",
        "The faucet is available on devnet only"
      );
    if (bs58.decode(req.auth.wallet).length !== 32)
      throw new AppError(400, "INVALID_WALLET", "Invalid recipient wallet");

    const faucetKeypair = await loadFaucetKeypair();
    if (!faucetKeypair)
      throw new AppError(
        503,
        "FAUCET_NOT_CONFIGURED",
        "Faucet keypair is not configured"
      );

    const cooldownHours = Number(process.env.FAUCET_COOLDOWN_HOURS || 24);
    const signature = await db.transaction(async (trx) => {
      await trx("users").where({ wallet: req.auth.wallet }).forUpdate().first();
      const previous = await trx("faucet_claims")
        .where({ wallet: req.auth.wallet })
        .first();
      if (
        previous &&
        Date.now() - new Date(previous.last_claimed_at).getTime() <
          cooldownHours * 3_600_000
      )
        throw new AppError(
          429,
          "FAUCET_COOLDOWN",
          `Faucet can be used once every ${cooldownHours} hours`
        );

      const connection = new Connection(
        process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
        "confirmed"
      );
      const mintPubkey = new PublicKey(process.env.AUSDC_MINT_ADDRESS);
      const recipientPubkey = new PublicKey(req.auth.wallet);
      const recipientAta = getAssociatedTokenAddressSync(
        mintPubkey,
        recipientPubkey
      );

      const tx = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(
          faucetKeypair.publicKey,
          recipientAta,
          recipientPubkey,
          mintPubkey
        ),
        createMintToInstruction(
          mintPubkey,
          recipientAta,
          faucetKeypair.publicKey,
          1000n * 1_000_000n
        )
      );

      const sig = await sendAndConfirmTransaction(connection, tx, [
        faucetKeypair,
      ]);

      await trx("faucet_claims")
        .insert({
          wallet: req.auth.wallet,
          last_claimed_at: new Date(),
          tx_output: sig,
        })
        .onConflict("wallet")
        .merge();
      return sig;
    });

    res.json({
      success: true,
      amount: "1000",
      recipient: req.auth.wallet,
      token: "aUSDC",
      output: signature,
      signature,
    });
  })
);

export { router as faucetRouter };
