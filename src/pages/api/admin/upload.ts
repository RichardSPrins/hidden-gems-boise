import type { APIRoute } from "astro";
import {
  uploadImage,
  ALLOWED_IMAGE_MIME,
  MAX_IMAGE_BYTES,
} from "@/lib/r2";

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function badRequest(message: string, code?: string) {
  return new Response(JSON.stringify({ error: message, code }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Generic admin image upload endpoint. Accepts multipart/form-data with a
 * single `file` field. Returns `{ key, url, contentType, size }`.
 *
 * Caller (the admin form) takes the returned URL and either includes it in a
 * business-create payload or posts it to /api/admin/businesses/[id]/images.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user as { role?: string } | null;
  if (!user || user.role !== "ADMIN") return unauthorized();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Invalid multipart body");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return badRequest("No file provided", "no_file");
  }

  if (file.size === 0) {
    return badRequest("File is empty", "empty_file");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return badRequest(
      `File is too large. Max ${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)} MB.`,
      "too_large",
    );
  }
  if (!ALLOWED_IMAGE_MIME.includes(file.type)) {
    return badRequest(
      `File type ${file.type || "(unknown)"} is not allowed. Use JPEG, PNG, or WebP.`,
      "bad_mime",
    );
  }

  const businessId =
    typeof form.get("businessId") === "string"
      ? (form.get("businessId") as string)
      : undefined;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadImage({
      buffer,
      contentType: file.type,
      businessId,
    });
    return new Response(
      JSON.stringify({
        key: result.key,
        url: result.url,
        contentType: file.type,
        size: file.size,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[upload] R2 upload failed", err);
    return new Response(
      JSON.stringify({ error: "Upload failed. Please try again." }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
};
