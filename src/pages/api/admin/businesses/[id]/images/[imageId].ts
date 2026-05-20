import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { image } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { deleteObject, keyFromUrl } from "@/lib/r2";

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

/** PATCH — update alt, sortOrder, or promote to primary. */
export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const user = locals.user as { role?: string } | null;
  if (!user || user.role !== "ADMIN") return unauthorized();

  const businessId = params.id as string;
  const imageId = params.imageId as string;
  if (!businessId || !imageId) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = (await request.json()) as {
    alt?: string | null;
    sortOrder?: number;
    isPrimary?: boolean;
  };

  // If promoting to primary, clear primary flag on siblings first.
  if (body.isPrimary === true) {
    await db
      .update(image)
      .set({ isPrimary: false })
      .where(eq(image.businessId, businessId));
  }

  const updates: Record<string, unknown> = {};
  if ("alt" in body) updates.alt = body.alt ?? null;
  if ("sortOrder" in body) updates.sortOrder = body.sortOrder;
  if ("isPrimary" in body) updates.isPrimary = Boolean(body.isPrimary);

  if (Object.keys(updates).length === 0) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  await db
    .update(image)
    .set(updates)
    .where(and(eq(image.id, imageId), eq(image.businessId, businessId)));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};

/** DELETE — remove DB row and best-effort delete the R2 object. */
export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user as { role?: string } | null;
  if (!user || user.role !== "ADMIN") return unauthorized();

  const businessId = params.id as string;
  const imageId = params.imageId as string;
  if (!businessId || !imageId) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Capture the URL before we delete the row so we can wipe R2.
  const row = await db.query.image.findFirst({
    where: and(eq(image.id, imageId), eq(image.businessId, businessId)),
    columns: { url: true },
  });

  await db
    .delete(image)
    .where(and(eq(image.id, imageId), eq(image.businessId, businessId)));

  if (row?.url) {
    const key = keyFromUrl(row.url);
    if (key) void deleteObject(key);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
