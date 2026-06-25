import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { image } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { deleteObject, keyFromUrl } from "@/lib/r2";
import { portalUser, getOwnedImage } from "@/lib/portal";

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function forbidden() {
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

/** PATCH — update alt or promote to primary, on an owned image. */
export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const user = portalUser(locals);
  if (!user) return unauthorized();

  const imageId = params.imageId as string;
  if (!imageId) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const owned = await getOwnedImage(user.id, imageId);
  if (!owned) return forbidden();

  const body = (await request.json()) as {
    alt?: string | null;
    sortOrder?: number;
    isPrimary?: boolean;
  };

  if (body.isPrimary === true) {
    await db
      .update(image)
      .set({ isPrimary: false })
      .where(eq(image.businessId, owned.businessId));
  }

  const updates: Record<string, unknown> = {};
  if ("alt" in body) updates.alt = body.alt ?? null;
  if ("sortOrder" in body) updates.sortOrder = body.sortOrder;
  if ("isPrimary" in body) updates.isPrimary = Boolean(body.isPrimary);

  if (Object.keys(updates).length > 0) {
    await db.update(image).set(updates).where(eq(image.id, imageId));
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};

/** DELETE — remove an owned image and best-effort wipe the R2 object. */
export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = portalUser(locals);
  if (!user) return unauthorized();

  const imageId = params.imageId as string;
  if (!imageId) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const owned = await getOwnedImage(user.id, imageId);
  if (!owned) return forbidden();

  await db.delete(image).where(eq(image.id, imageId));

  if (owned.url) {
    const key = keyFromUrl(owned.url);
    if (key) void deleteObject(key);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
