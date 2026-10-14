import crypto from "node:crypto";
import { Router } from "express";
import jwt from "jsonwebtoken";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { z } from "zod";
import { db } from "../db/index.js";
import {
  createAuthNonce,
  createSignInMessage,
} from "../services/auth-message.js";
import { AppError, asyncHandler } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const walletSchema = z.string().min(32).max(44);

router.post(
  "/nonce",
  asyncHandler(async (req, res) => {
    const { wallet } = z.object({ wallet: walletSchema }).parse(req.body);
    let publicKey;
    try {
      publicKey = bs58.decode(wallet);
    } catch {
      throw new AppError(
        400,
        "INVALID_WALLET",
        "Wallet must be base58 encoded"
      );
    }
    if (publicKey.length !== nacl.sign.publicKeyLength)
      throw new AppError(
        400,
        "INVALID_WALLET",
        "Wallet must be a Solana public key"
      );

    // SIWS nonces must contain only letters and digits. Hex keeps the
    // challenge cryptographically random while remaining wallet-parseable.
    const nonce = createAuthNonce();
    const issuedAt = new Date();
    const expirationTime = new Date(issuedAt.getTime() + 5 * 60_000);
    const domain = new URL(process.env.APP_ORIGIN || "http://localhost:3000")
      .host;
    const uri = process.env.APP_ORIGIN || "http://localhost:3000";
    const message = createSignInMessage({
      domain,
      uri,
      wallet,
      nonce,
      issuedAt: issuedAt.toISOString(),
      expirationTime: expirationTime.toISOString(),
      chain: process.env.SOLANA_CLUSTER || "devnet",
    });

    await db("users")
      .insert({
        wallet,
        nonce,
        nonce_expires_at: expirationTime,
        nonce_domain: domain,
        nonce_uri: uri,
        nonce_issued_at: issuedAt,
      })
      .onConflict("wallet")
      .merge({
        nonce,
        nonce_expires_at: expirationTime,
        nonce_domain: domain,
        nonce_uri: uri,
        nonce_issued_at: issuedAt,
      });
    res.json({ wallet, message, expiresAt: expirationTime.toISOString() });
  })
);

router.post(
  "/verify",
  asyncHandler(async (req, res) => {
    const { wallet, signature, message } = z
      .object({
        wallet: walletSchema,
        signature: z.string().min(1),
        message: z.string().min(1).max(2048),
      })
      .parse(req.body);
    const user = await db("users").where({ wallet }).first();
    if (!user?.nonce || new Date(user.nonce_expires_at) <= new Date())
      throw new AppError(400, "NONCE_EXPIRED", "Request a new nonce");

    const expected = createSignInMessage({
      domain: user.nonce_domain,
      uri: user.nonce_uri,
      wallet,
      nonce: user.nonce,
      issuedAt: new Date(user.nonce_issued_at).toISOString(),
      expirationTime: new Date(user.nonce_expires_at).toISOString(),
      chain: process.env.SOLANA_CLUSTER || "devnet",
    });
    if (message !== expected)
      throw new AppError(
        400,
        "INVALID_MESSAGE",
        "Signed message does not match the issued challenge"
      );

    let valid = false;
    try {
      valid = nacl.sign.detached.verify(
        Buffer.from(message),
        bs58.decode(signature),
        bs58.decode(wallet)
      );
    } catch {}
    if (!valid)
      throw new AppError(
        401,
        "INVALID_SIGNATURE",
        "Wallet signature is invalid"
      );

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 86_400_000);
    await db.transaction(async (trx) => {
      const consumed = await trx("users")
        .where({ wallet, nonce: user.nonce })
        .update({ nonce: null, nonce_expires_at: null });
      if (consumed !== 1)
        throw new AppError(409, "NONCE_USED", "Nonce was already used");
      await trx("auth_sessions").insert({
        id: sessionId,
        wallet,
        expires_at: expiresAt,
      });
    });
    const token = jwt.sign({}, process.env.JWT_SECRET, {
      algorithm: "HS256",
      subject: wallet,
      jwtid: sessionId,
      issuer: "acai-api",
      audience: "acai-web",
      expiresIn: "7d",
    });
    res.json({ token, wallet, expiresAt: expiresAt.toISOString() });
  })
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await db("auth_sessions")
      .where({ id: req.auth.sessionId })
      .update({ revoked_at: new Date() });
    res.status(204).end();
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await db("users")
      .select("wallet", "created_at")
      .where({ wallet: req.auth.wallet })
      .first();
    res.json({ user });
  })
);

export { router as authRouter };
