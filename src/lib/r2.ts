/**
 * Cloudflare R2 storage client. R2 is S3-compatible, so we use the AWS SDK
 * with the R2 endpoint pinned to your account.
 *
 * Object keys are namespaced by business so all images for a single listing
 * live under one prefix — easier to delete in bulk, easier to audit.
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { createId } from "@paralleldrive/cuid2";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const ALLOWED_IMAGE_MIME = Object.keys(MIME_TO_EXT);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

let client: S3Client | null = null;

function r2Client(): S3Client {
  if (client) return client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials missing — set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY");
  }
  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

function bucketName(): string {
  const b = process.env.R2_BUCKET_NAME;
  if (!b) throw new Error("R2_BUCKET_NAME not set");
  return b;
}

function publicBaseUrl(): string {
  const u = process.env.R2_PUBLIC_BASE_URL;
  if (!u) throw new Error("R2_PUBLIC_BASE_URL not set");
  return u.replace(/\/$/, "");
}

export interface UploadResult {
  key: string;
  url: string;
}

export async function uploadImage(opts: {
  buffer: Buffer | Uint8Array;
  contentType: string;
  businessId?: string;
}): Promise<UploadResult> {
  const ext = MIME_TO_EXT[opts.contentType];
  if (!ext) throw new Error(`Unsupported image type: ${opts.contentType}`);

  const prefix = opts.businessId ? `businesses/${opts.businessId}` : "uploads";
  const key = `${prefix}/${createId()}.${ext}`;

  await r2Client().send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: key,
      Body: opts.buffer,
      ContentType: opts.contentType,
      // 1-year cache; images are immutable (we never overwrite a key).
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return {
    key,
    url: `${publicBaseUrl()}/${key}`,
  };
}

/** Best-effort delete. Returns true on success, false on failure (logs but doesn't throw). */
export async function deleteObject(key: string): Promise<boolean> {
  try {
    await r2Client().send(
      new DeleteObjectCommand({ Bucket: bucketName(), Key: key }),
    );
    return true;
  } catch (err) {
    console.error("[r2] delete failed", { key, err });
    return false;
  }
}

/** Extract the R2 object key from a stored public URL. Returns null if the URL doesn't match our R2 base. */
export function keyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) return null;
  const trimmed = base.replace(/\/$/, "");
  if (!url.startsWith(trimmed + "/")) return null;
  return url.slice(trimmed.length + 1);
}
