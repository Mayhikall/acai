import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";

const assets = new Set([
  "hero.mp4",
  "process.mp4",
  "details.mp4",
  "closing.mp4",
  "hero.jpg",
  "process.jpg",
  "details.jpg",
  "closing.jpg",
]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ asset: string }> }
) {
  const { asset } = await context.params;
  if (!assets.has(asset)) return new Response("Not found", { status: 404 });
  try {
    const file = await readFile(
      path.join(process.cwd(), "app", "_assets", asset)
    );
    const headers = new Headers({
      "Content-Type": asset.endsWith("mp4") ? "video/mp4" : "image/jpeg",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    });
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2]))
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${file.length}` },
        });
      const start = match[1]
        ? Number(match[1])
        : Math.max(0, file.length - Number(match[2]));
      const end =
        match[1] && match[2]
          ? Math.min(Number(match[2]), file.length - 1)
          : file.length - 1;
      if (start >= file.length || start > end)
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${file.length}` },
        });
      headers.set("Content-Range", `bytes ${start}-${end}/${file.length}`);
      headers.set("Content-Length", String(end - start + 1));
      return new Response(new Uint8Array(file.subarray(start, end + 1)), {
        status: 206,
        headers,
      });
    }
    headers.set("Content-Length", String(file.length));
    return new Response(new Uint8Array(file), { headers });
  } catch {
    return new Response("Media unavailable", { status: 404 });
  }
}
