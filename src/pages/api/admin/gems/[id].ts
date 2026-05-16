import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { gemSpotlight, business } from "@/lib/db/schema";
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
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  for (const f of ["headline", "writeup", "weekLabel"] as const) {
    if (f in body) updates[f] = body[f];
  }
  if ("shortDescription" in body) {
    const v = typeof body.shortDescription === "string" ? body.shortDescription.trim() : "";
    updates.shortDescription = v.length > 0 ? v : null;
  }
  if ("publish" in body) {
    updates.publishedAt = body.publish ? new Date() : null;
  }

  await db.update(gemSpotlight).set(updates).where(eq(gemSpotlight.id, id));

  if ("publish" in body) {
    const spot = await db.query.gemSpotlight.findFirst({
      where: eq(gemSpotlight.id, id),
    });
    if (spot) {
      await db
        .update(business)
        .set({
          isGemOfWeek: Boolean(body.publish),
          gemWeekDate: body.publish ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(business.id, spot.businessId));
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
  await db.delete(gemSpotlight).where(eq(gemSpotlight.id, id));
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
