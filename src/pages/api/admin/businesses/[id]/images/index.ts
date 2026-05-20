import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { business, image } from "@/lib/db/schema";
import { eq, desc, asc } from "drizzle-orm";

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

/** List images for a business — admin-gated. */
export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user as { role?: string } | null;
  if (!user || user.role !== "ADMIN") return unauthorized();

  const id = params.id as string;
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const images = await db.query.image.findMany({
    where: eq(image.businessId, id),
    orderBy: [desc(image.isPrimary), asc(image.sortOrder)],
  });

  return new Response(JSON.stringify({ images }), {
    headers: { "Content-Type": "application/json" },
  });
};

/**
 * Attach an already-uploaded image to a business. The /api/admin/upload
 * endpoint hands you back `{url, key}` — pass that in here after the file
 * lands in R2.
 *
 * Body: { url, alt?, isPrimary? }
 */
export const POST: APIRoute = async ({ request, params, locals }) => {
  const user = locals.user as { role?: string } | null;
  if (!user || user.role !== "ADMIN") return unauthorized();

  const businessId = params.id as string;
  if (!businessId) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Confirm the business exists before attaching.
  const biz = await db.query.business.findFirst({
    where: eq(business.id, businessId),
    columns: { id: true },
  });
  if (!biz) {
    return new Response(JSON.stringify({ error: "Business not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

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

  // If marked primary, clear primary flag on the rest first.
  if (body.isPrimary) {
    await db
      .update(image)
      .set({ isPrimary: false })
      .where(eq(image.businessId, businessId));
  }

  // Append at the end of the existing sort order.
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

  return new Response(
    JSON.stringify({ id: inserted[0].id, url }),
    { status: 201, headers: { "Content-Type": "application/json" } },
  );
};
