import "dotenv/config";
import bs58 from "bs58";
import nacl from "tweetnacl";

const apiOrigin = process.env.API_ORIGIN || "http://localhost:4000";
const timeoutAt = Date.now() + 3 * 60_000;
const keypair = nacl.sign.keyPair();
const wallet = bs58.encode(keypair.publicKey);

async function request(path, options = {}) {
  const response = await fetch(`${apiOrigin}${path}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

function jsonOptions(body, token) {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  };
}

const health = await request("/health");
if (!health.response.ok)
  throw new Error(`Backend is unavailable at ${apiOrigin}`);

const nonce = await request("/auth/nonce", jsonOptions({ wallet }));
if (!nonce.response.ok) throw new Error(JSON.stringify(nonce.body));

const signature = bs58.encode(
  nacl.sign.detached(Buffer.from(nonce.body.message), keypair.secretKey)
);
const verified = await request(
  "/auth/verify",
  jsonOptions({ wallet, signature, message: nonce.body.message })
);
if (!verified.response.ok) throw new Error(JSON.stringify(verified.body));
const token = verified.body.token;

const connected = await request("/youtube/connect", {
  headers: { authorization: `Bearer ${token}` },
});
if (!connected.response.ok) throw new Error(JSON.stringify(connected.body));

console.log("\nOpen this URL in your browser and approve YouTube access:\n");
console.log(connected.body.url);
console.log("\nWaiting for the OAuth callback (up to 3 minutes)...\n");

let videos;
while (Date.now() < timeoutAt) {
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  const result = await request("/youtube/videos", {
    headers: { authorization: `Bearer ${token}` },
  });
  if (result.response.ok) {
    videos = result.body.videos;
    break;
  }
  if (result.response.status !== 404)
    throw new Error(JSON.stringify(result.body));
}

if (!videos) throw new Error("OAuth was not completed within 3 minutes");

console.log(`Connected successfully. Received ${videos.length} video(s):`);
console.table(
  videos.map(({ videoId, title, publishedAt, durationSeconds, viewCount }) => ({
    videoId,
    title,
    publishedAt,
    durationSeconds,
    viewCount,
  }))
);

const disconnected = await request("/youtube/channel", {
  method: "DELETE",
  headers: { authorization: `Bearer ${token}` },
});
if (!disconnected.response.ok) {
  console.warn("Test succeeded, but automatic channel cleanup failed.");
} else {
  console.log("Test channel connection was revoked and cleaned up.");
}
