import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError, asyncHandler } from "../lib/errors.js";
import { encryptSecret, decryptSecret } from "../services/token-crypto.js";
import {
  createOAuthClient,
  youtubeService,
} from "../services/youtube/index.js";

const router = Router();

router.get(
  "/connect",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (process.env.YOUTUBE_ADAPTER === "mock") {
      const channel = await youtubeService.getOwnChannel();
      const existing = await db("youtube_channels")
        .where({ channel_id: channel.channelId })
        .first();
      if (
        existing &&
        !existing.revoked_at &&
        existing.wallet !== req.auth.wallet
      )
        throw new AppError(
          409,
          "CHANNEL_ALREADY_LINKED",
          "This channel belongs to another wallet"
        );
      await db("youtube_channels")
        .insert({
          wallet: req.auth.wallet,
          channel_id: channel.channelId,
          title: channel.title,
          subscriber_count: channel.subscriberCount,
          channel_created_at: channel.channelCreatedAt,
          uploads_playlist_id: channel.uploadsPlaylistId,
          refresh_token_encrypted: "mock",
        })
        .onConflict("channel_id")
        .merge({
          wallet: req.auth.wallet,
          title: channel.title,
          revoked_at: null,
        });
      return res.json({ connected: true, mock: true, channel });
    }

    const state = crypto.randomUUID();
    await db("oauth_states").insert({
      id: state,
      wallet: req.auth.wallet,
      expires_at: new Date(Date.now() + 10 * 60_000),
    });
    const url = createOAuthClient().generateAuthUrl({
      access_type: "offline",
      include_granted_scopes: true,
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/youtube.readonly"],
      state,
    });
    res.json({ url });
  })
);

router.get(
  "/callback",
  asyncHandler(async (req, res) => {
    if (process.env.YOUTUBE_ADAPTER === "mock")
      return res.redirect(
        `${process.env.APP_ORIGIN || "http://localhost:3000"}/dashboard?youtube=connected`
      );
    const { code, state } = z
      .object({ code: z.string().min(1), state: z.string().uuid() })
      .parse(req.query);
    const oauthState = await db("oauth_states")
      .where({ id: state })
      .whereNull("consumed_at")
      .first();
    if (!oauthState || new Date(oauthState.expires_at) <= new Date())
      throw new AppError(
        400,
        "INVALID_OAUTH_STATE",
        "OAuth state is expired or invalid"
      );

    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token)
      throw new AppError(
        400,
        "REFRESH_TOKEN_MISSING",
        "Google did not return a refresh token; revoke access and connect again"
      );
    client.setCredentials(tokens);
    const channel = await youtubeService.getOwnChannel(client);
    if (!channel)
      throw new AppError(
        404,
        "CHANNEL_NOT_FOUND",
        "No YouTube channel was found for this account"
      );
    const existing = await db("youtube_channels")
      .where({ channel_id: channel.channelId })
      .first();
    if (
      existing &&
      !existing.revoked_at &&
      existing.wallet !== oauthState.wallet
    )
      throw new AppError(
        409,
        "CHANNEL_ALREADY_LINKED",
        "This channel belongs to another wallet"
      );

    await db.transaction(async (trx) => {
      const consumed = await trx("oauth_states")
        .where({ id: state })
        .whereNull("consumed_at")
        .update({ consumed_at: new Date() });
      if (consumed !== 1)
        throw new AppError(
          409,
          "OAUTH_STATE_USED",
          "OAuth callback was already used"
        );
      await trx("youtube_channels")
        .insert({
          wallet: oauthState.wallet,
          channel_id: channel.channelId,
          title: channel.title,
          subscriber_count: channel.subscriberCount,
          channel_created_at: channel.channelCreatedAt,
          uploads_playlist_id: channel.uploadsPlaylistId,
          refresh_token_encrypted: encryptSecret(tokens.refresh_token),
        })
        .onConflict("channel_id")
        .merge({
          wallet: oauthState.wallet,
          title: channel.title,
          subscriber_count: channel.subscriberCount,
          channel_created_at: channel.channelCreatedAt,
          uploads_playlist_id: channel.uploadsPlaylistId,
          refresh_token_encrypted: encryptSecret(tokens.refresh_token),
          revoked_at: null,
        });
    });
    res.redirect(
      `${process.env.APP_ORIGIN || "http://localhost:3000"}/dashboard?youtube=connected`
    );
  })
);

router.get(
  "/videos",
  requireAuth,
  asyncHandler(async (req, res) => {
    const channels = await db("youtube_channels")
      .where({ wallet: req.auth.wallet })
      .whereNull("revoked_at");
    if (!channels.length)
      throw new AppError(
        404,
        "CHANNEL_NOT_CONNECTED",
        "Connect a YouTube channel first"
      );
    const videos = [];
    for (const channel of channels) {
      let auth;
      if (process.env.YOUTUBE_ADAPTER === "api") {
        auth = createOAuthClient();
        auth.setCredentials({
          refresh_token: decryptSecret(channel.refresh_token_encrypted),
        });
      }
      videos.push(
        ...(await youtubeService.listOwnVideos(
          auth,
          channel.uploads_playlist_id,
          50
        ))
      );
    }
    res.json({ videos });
  })
);

router.delete(
  "/channel",
  requireAuth,
  asyncHandler(async (req, res) => {
    const channel = await db("youtube_channels")
      .where({ wallet: req.auth.wallet })
      .whereNull("revoked_at")
      .first();
    if (!channel)
      throw new AppError(
        404,
        "CHANNEL_NOT_CONNECTED",
        "No connected channel found"
      );
    if (process.env.YOUTUBE_ADAPTER === "api") {
      try {
        const client = createOAuthClient();
        client.setCredentials({
          refresh_token: decryptSecret(channel.refresh_token_encrypted),
        });
        await client.revokeCredentials();
      } catch (error) {
        req.log.warn(
          { err: error },
          "Google token revocation failed; local token will still be removed"
        );
      }
    }
    await db("youtube_channels")
      .where({ id: channel.id })
      .update({ revoked_at: new Date(), refresh_token_encrypted: "REVOKED" });
    res.status(204).end();
  })
);

export { router as youtubeRouter };
