import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { business, contactInfo, image, location } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const user = locals.user as { role?: string } | null;
  if (!user || user.role !== "ADMIN") return unauthorized();

  const id = params.id as string;
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const fields = [
    "name",
    "bio",
    "editorialBlurb",
    "websiteUrl",
    "bookingUrl",
    "categoryId",
    "subcategoryId",
    "pricePoint",
    "status",
    "isVerified",
    "isGemOfWeek",
  ] as const;
  for (const f of fields) {
    if (f in body) updates[f] = body[f];
  }
  if (Array.isArray(body.keywords)) updates.keywords = body.keywords;

  await db.update(business).set(updates).where(eq(business.id, id));

  // Optional contact info upsert
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

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user as { role?: string } | null;
  if (!user || user.role !== "ADMIN") return unauthorized();

  const id = params.id as string;
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Cascade is set on most child tables; business row delete is sufficient.
  await db.delete(business).where(eq(business.id, id));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};

// Quiet unused-import warnings; kept for future expansion.
void image;
void location;
