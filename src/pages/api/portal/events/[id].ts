import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { event, location } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { portalUser, getOwnedEvent } from "@/lib/portal";

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const EVENT_CATEGORIES = [
  "GRAND_OPENING",
  "SALE_AND_PROMOTION",
  "WORKSHOP_AND_CLASS",
  "LIVE_MUSIC_AND_ENTERTAINMENT",
  "COMMUNITY_AND_NETWORKING",
  "FOOD_AND_DRINK_SPECIAL",
  "SEASONAL_AND_HOLIDAY",
  "CHARITY_AND_FUNDRAISER",
  "OTHER",
];
const RECURRENCE = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"];

/**
 * Edit an owned event. Any owner edit sends the event back to review
 * (isActive=false) so changes are re-approved before showing publicly.
 */
export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const user = portalUser(locals);
  if (!user) return unauthorized();

  const id = params.id as string;
  if (!id) return bad("Missing id");

  const owned = await getOwnedEvent(user.id, id);
  if (!owned) return bad("Forbidden", 403);

  const body = await request.json();
  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
    isActive: false, // re-queue for review on any edit
  };

  if ("title" in body) {
    const t = (body.title || "").trim();
    if (!t) return bad("title required");
    updates.title = t;
  }
  if ("description" in body)
    updates.description = body.description?.trim() || null;
  if ("category" in body) {
    const c = (body.category || "").toUpperCase();
    if (!EVENT_CATEGORIES.includes(c)) return bad("Invalid category");
    updates.category = c;
  }
  if ("startDateTime" in body) {
    const s = body.startDateTime ? new Date(body.startDateTime) : null;
    if (!s || Number.isNaN(s.getTime())) return bad("Valid start required");
    updates.startDateTime = s;
  }
  if ("endDateTime" in body) {
    const e = body.endDateTime ? new Date(body.endDateTime) : null;
    if (e && Number.isNaN(e.getTime())) return bad("Invalid end date");
    updates.endDateTime = e;
  }
  if ("ticketUrl" in body) updates.ticketUrl = body.ticketUrl?.trim() || null;
  if ("isRecurring" in body) updates.isRecurring = Boolean(body.isRecurring);
  if ("recurrenceFrequency" in body) {
    const r = (body.recurrenceFrequency || "").toUpperCase();
    updates.recurrenceFrequency = RECURRENCE.includes(r) ? r : null;
  }
  if ("recurrenceEndsAt" in body)
    updates.recurrenceEndsAt = body.recurrenceEndsAt
      ? new Date(body.recurrenceEndsAt)
      : null;

  if ("locationId" in body) {
    if (body.locationId) {
      const loc = await db.query.location.findFirst({
        where: and(
          eq(location.id, body.locationId),
          eq(location.businessId, owned.businessId),
        ),
        columns: { id: true },
      });
      if (!loc) return bad("Location not found for this business");
      updates.locationId = loc.id;
    } else {
      updates.locationId = null;
    }
  }

  await db.update(event).set(updates).where(eq(event.id, id));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};

/** Delete an owned event. */
export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = portalUser(locals);
  if (!user) return unauthorized();

  const id = params.id as string;
  if (!id) return bad("Missing id");

  const owned = await getOwnedEvent(user.id, id);
  if (!owned) return bad("Forbidden", 403);

  await db.delete(event).where(eq(event.id, id));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
