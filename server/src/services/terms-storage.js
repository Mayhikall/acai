import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: { persistSession: false, autoRefreshToken: false },
        }
      )
    : null;

export async function uploadTerms(campaignId, bytes) {
  const objectPath = `${campaignId}/terms.pdf`;
  if (supabase) {
    const { error } = await supabase.storage
      .from(process.env.SUPABASE_TERMS_BUCKET || "campaign-terms")
      .upload(objectPath, bytes, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (error) throw error;
    return objectPath;
  }
  if (process.env.NODE_ENV === "production")
    throw new Error("Supabase storage is not configured");
  const localPath = path.resolve(
    process.cwd(),
    "uploads",
    "campaign-terms",
    objectPath
  );
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, bytes, { flag: "wx" });
  return objectPath;
}

export async function getTermsUrl(objectPath) {
  if (supabase) {
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_TERMS_BUCKET || "campaign-terms")
      .createSignedUrl(objectPath, 300);
    if (error) throw error;
    return data.signedUrl;
  }
  return `${process.env.API_ORIGIN || "http://localhost:4000"}/campaign-terms/${objectPath}`;
}
