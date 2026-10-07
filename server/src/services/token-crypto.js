import crypto from "node:crypto";

function encryptionKey() {
  if (!process.env.TOKEN_ENCRYPTION_KEY)
    return crypto.createHash("sha256").update(process.env.JWT_SECRET).digest();
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "base64");
  if (key.length !== 32)
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key"
    );
  return key;
}

export function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(value) {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !encrypted)
    throw new Error("Unsupported encrypted token format");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
