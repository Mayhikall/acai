import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { authRouter } from "./routes/auth.js";
import { campaignsRouter } from "./routes/campaigns.js";
import { faucetRouter } from "./routes/faucet.js";
import { internalRouter } from "./routes/internal.js";
import { meRouter } from "./routes/me.js";
import { submissionsRouter } from "./routes/submissions.js";
import { youtubeRouter } from "./routes/youtube.js";
import { errorHandler, notFound } from "./lib/errors.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    pinoHttp({
      redact: ["req.headers.authorization", "req.headers.x-internal-secret"],
    })
  );
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: process.env.APP_ORIGIN || "http://localhost:3000",
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  if (process.env.NODE_ENV !== "production")
    app.use(
      "/campaign-terms",
      express.static(path.resolve(process.cwd(), "uploads", "campaign-terms"), {
        dotfiles: "deny",
        index: false,
      })
    );

  app.get("/health", (_req, res) =>
    res.json({ status: "ok", timestamp: new Date().toISOString() })
  );
  app.use("/auth", authRouter);
  app.use("/youtube", youtubeRouter);
  app.use("/campaigns", campaignsRouter);
  app.use(submissionsRouter);
  app.use("/me", meRouter);
  app.use("/faucet", faucetRouter);
  app.use("/internal", internalRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
