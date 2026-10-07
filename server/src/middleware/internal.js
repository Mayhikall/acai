import crypto from "node:crypto";
import { AppError } from "../lib/errors.js";

export function requireInternalSecret(req, _res, next) {
  const supplied = Buffer.from(String(req.headers["x-internal-secret"] ?? ""));
  const expected = Buffer.from(process.env.INTERNAL_API_SECRET);
  if (
    supplied.length !== expected.length ||
    !crypto.timingSafeEqual(supplied, expected)
  )
    return next(new AppError(401, "UNAUTHORIZED", "Invalid internal secret"));
  next();
}
