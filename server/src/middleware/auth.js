import jwt from "jsonwebtoken";
import { db } from "../db/index.js";
import { AppError, asyncHandler } from "../lib/errors.js";

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization ?? "").split(" ");
  if (scheme !== "Bearer" || !token)
    throw new AppError(401, "UNAUTHORIZED", "Missing bearer token");

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "acai-api",
      audience: "acai-web",
    });
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Session is expired or invalid");
  }

  const session = await db("auth_sessions")
    .where({ id: payload.jti, wallet: payload.sub })
    .whereNull("revoked_at")
    .first();
  if (!session || new Date(session.expires_at) <= new Date())
    throw new AppError(401, "UNAUTHORIZED", "Session is expired or revoked");
  req.auth = { wallet: payload.sub, sessionId: payload.jti };
  next();
});
