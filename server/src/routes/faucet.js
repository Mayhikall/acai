import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Router } from "express";
import bs58 from "bs58";
import { db } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError, asyncHandler } from "../lib/errors.js";

const run = promisify(execFile);
const router = Router();

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

    const cooldownHours = Number(process.env.FAUCET_COOLDOWN_HOURS || 24);
    const output = await db.transaction(async (trx) => {
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
      const faucetArgs = [];
      if (process.env.FAUCET_KEYPAIR_PATH)
        faucetArgs.push(
          "--owner",
          process.env.FAUCET_KEYPAIR_PATH,
          "--fee-payer",
          process.env.FAUCET_KEYPAIR_PATH
        );
      faucetArgs.push(
        "mint",
        process.env.AUSDC_MINT_ADDRESS,
        "1000",
        req.auth.wallet,
        "--url",
        "devnet"
      );
      const { stdout } = await run(
        process.env.FAUCET_COMMAND || "spl-token",
        faucetArgs,
        { timeout: 30_000 }
      );
      await trx("faucet_claims")
        .insert({
          wallet: req.auth.wallet,
          last_claimed_at: new Date(),
          tx_output: stdout.trim(),
        })
        .onConflict("wallet")
        .merge();
      return stdout.trim();
    });
    res.json({
      success: true,
      amount: "1000",
      recipient: req.auth.wallet,
      token: "aUSDC",
      output,
    });
  })
);

export { router as faucetRouter };
