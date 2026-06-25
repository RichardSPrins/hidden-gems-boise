import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { location } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { portalUser, ownsBusiness } from "@/lib/portal";
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

/** Create a location (with optional 7-day hours) on an owned business. */
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

  const body = await request.json();
  const address = (body.address || "").trim();
  const city = (body.city || "").trim();
  const zip = (body.zip || "").trim();
  if (!address || !city || !zip) {
    return new Response(
      JSON.stringify({ error: "address, city and zip are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // If this is to be primary, clear the flag on siblings first.
  if (body.isPrimary) {
    await db
      .update(location)
      .set({ isPrimary: false })
      .where(eq(location.businessId, businessId));
  }

  const inserted = await db
    .insert(location)
    .values({
      businessId,
      isPrimary: Boolean(body.isPrimary),
      address,
      city,
      state: (body.state || "ID").trim(),
      zip,
      neighborhood: body.neighborhood?.trim() || null,
    })
    .returning({ id: location.id });

  const locationId = inserted[0].id;
  const hours = normalizeHours(body.hours);
  if (hours) await replaceHours(locationId, hours);

  return new Response(JSON.stringify({ id: locationId }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
