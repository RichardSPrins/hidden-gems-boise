import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { business, event, location } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { portalUser, ownsBusiness } from "@/lib/portal";
import { notifyAdmin } from "@/lib/email/notify";
import { eventSubmittedAdminEmail } from "@/lib/email/templates";

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
 * Create an event on an owned business. Owner events are held for review
 * (isActive=false) — an admin approves them in /admin/events before they show
 * publicly.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const user = portalUser(locals);
  if (!user) return unauthorized();

  const body = await request.json();
  const businessId = (body.businessId || "").trim();
  if (!businessId) return bad("businessId required");
  if (!(await ownsBusiness(user.id, businessId)))
    return bad("Forbidden", 403);

  const title = (body.title || "").trim();
  if (!title) return bad("title required");

  const category = (body.category || "").toUpperCase();
  if (!EVENT_CATEGORIES.includes(category)) return bad("Invalid category");

  const start = body.startDateTime ? new Date(body.startDateTime) : null;
  if (!start || Number.isNaN(start.getTime())) return bad("Valid start required");
  const end = body.endDateTime ? new Date(body.endDateTime) : null;
  if (end && Number.isNaN(end.getTime())) return bad("Invalid end date");

  // If a location is supplied, it must belong to this business.
  let locationId: string | null = null;
  if (body.locationId) {
    const loc = await db.query.location.findFirst({
      where: and(
        eq(location.id, body.locationId),
        eq(location.businessId, businessId),
      ),
      columns: { id: true },
    });
    if (!loc) return bad("Location not found for this business");
    locationId = loc.id;
  }

  const isRecurring = Boolean(body.isRecurring);
  const recurrenceFrequency =
    isRecurring && RECURRENCE.includes((body.recurrenceFrequency || "").toUpperCase())
      ? (body.recurrenceFrequency as string).toUpperCase()
      : null;

  const inserted = await db
    .insert(event)
    .values({
      businessId,
      locationId,
      title,
      description: body.description?.trim() || null,
      category,
      startDateTime: start,
      endDateTime: end,
      ticketUrl: body.ticketUrl?.trim() || null,
      isRecurring,
      recurrenceFrequency: recurrenceFrequency as never,
      recurrenceEndsAt: body.recurrenceEndsAt
        ? new Date(body.recurrenceEndsAt)
        : null,
      isActive: false, // held for admin review
    })
    .returning({ id: event.id });

  // Notify the team that an event is awaiting approval.
  const biz = await db.query.business.findFirst({
    where: eq(business.id, businessId),
    columns: { name: true },
  });
  void notifyAdmin(
    eventSubmittedAdminEmail({
      businessName: biz?.name ?? "A business",
      eventTitle: title,
      url: new URL("/admin/events", request.url).toString(),
    }),
  );

  return new Response(JSON.stringify({ id: inserted[0].id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
