import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { image } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { portalUser, ownsBusiness } from "@/lib/portal";

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

/**
 * Attach an already-uploaded image (from /api/portal/upload) to an owned
 * business. Body: { url, alt?, isPrimary? }.
 */
export const POST: APIRoute = async ({ request, params, locals }) => {
  const user = portalUser(locals);
  if (!user) return unauthorized();

  const businessId = params.id as string;
  if (!businessId) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!(await ownsBusiness(user.id, businessId))) return forbidden();

  const body = (await request.json()) as {
    url?: string;
    alt?: string;
    isPrimary?: boolean;
  };
  const url = body.url?.trim();
  if (!url) {
    return new Response(JSON.stringify({ error: "url required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (body.isPrimary) {
    await db
      .update(image)
      .set({ isPrimary: false })
      .where(eq(image.businessId, businessId));
  }

  const existing = await db.query.image.findMany({
    where: eq(image.businessId, businessId),
    orderBy: desc(image.sortOrder),
    limit: 1,
    columns: { sortOrder: true },
  });
  const nextOrder = (existing[0]?.sortOrder ?? -1) + 1;

  const inserted = await db
    .insert(image)
    .values({
      businessId,
      url,
      alt: body.alt?.trim() || null,
      isPrimary: Boolean(body.isPrimary),
      sortOrder: nextOrder,
    })
    .returning({ id: image.id });

  return new Response(JSON.stringify({ id: inserted[0].id, url }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
