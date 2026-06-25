import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { location } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { portalUser, getOwnedLocation } from "@/lib/portal";
import { normalizeHours, replaceHours } from "@/lib/portal-hours";

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

/** Update an owned location and (optionally) replace its hours. */
export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const user = portalUser(locals);
  if (!user) return unauthorized();

  const locationId = params.locationId as string;
  if (!locationId) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const owned = await getOwnedLocation(user.id, locationId);
  if (!owned) return forbidden();

  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if ("address" in body) updates.address = (body.address || "").trim();
  if ("city" in body) updates.city = (body.city || "").trim();
  if ("state" in body) updates.state = (body.state || "ID").trim();
  if ("zip" in body) updates.zip = (body.zip || "").trim();
  if ("neighborhood" in body)
    updates.neighborhood = body.neighborhood?.trim() || null;

  // Promote to primary → clear siblings first.
  if (body.isPrimary === true) {
    await db
      .update(location)
      .set({ isPrimary: false })
      .where(eq(location.businessId, owned.businessId));
    updates.isPrimary = true;
  } else if (body.isPrimary === false) {
    updates.isPrimary = false;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(location).set(updates).where(eq(location.id, locationId));
  }

  const hours = normalizeHours(body.hours);
  if (hours) await replaceHours(locationId, hours);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};

/** Delete an owned location (hours cascade via FK). */
export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = portalUser(locals);
  if (!user) return unauthorized();

  const locationId = params.locationId as string;
  if (!locationId) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const owned = await getOwnedLocation(user.id, locationId);
  if (!owned) return forbidden();

  await db.delete(location).where(eq(location.id, locationId));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
