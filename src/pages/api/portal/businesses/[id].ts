import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { business, contactInfo } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
 * Owner edit of their own listing. Edits go live immediately — the claim
 * approval is the gate, not each save. Admin-only fields (status, isVerified,
 * isGemOfWeek, editorialBlurb) are deliberately not editable here.
 */
export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const user = portalUser(locals);
  if (!user) return unauthorized();

  const id = params.id as string;
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!(await ownsBusiness(user.id, id))) return forbidden();

  const body = await request.json();

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const fields = [
    "name",
    "bio",
    "websiteUrl",
    "bookingUrl",
    "categoryId",
    "subcategoryId",
    "pricePoint",
  ] as const;
  for (const f of fields) {
    if (f in body) updates[f] = body[f];
  }
  if (Array.isArray(body.keywords)) updates.keywords = body.keywords;

  await db.update(business).set(updates).where(eq(business.id, id));

  // Contact info upsert (one-to-one with business).
  if (body.contact) {
    const { phone, email } = body.contact as { phone?: string; email?: string };
    const existing = await db.query.contactInfo.findFirst({
      where: eq(contactInfo.businessId, id),
    });
    if (existing) {
      await db
        .update(contactInfo)
        .set({ phone: phone ?? null, email: email ?? null })
        .where(eq(contactInfo.businessId, id));
    } else if (phone || email) {
      await db.insert(contactInfo).values({
        businessId: id,
        phone: phone || null,
        email: email || null,
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
