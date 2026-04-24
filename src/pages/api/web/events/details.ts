// src/pages/api/web/event-detail.ts
import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import {
  event,
  eventComment,
  business,
  location,
  image,
} from "@/lib/db/schema";
import { eq, and, ne, asc, desc, gte, sql } from "drizzle-orm";

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id") ?? "";

    if (!id) {
      return new Response(JSON.stringify({ notFound: true }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Main event with all relations
    const evt = await db.query.event.findFirst({
      where: eq(event.id, id),
      with: {
        business: {
          with: {
            category: true,
            contact: true,
            images: { where: eq(image.isPrimary, true), limit: 1 },
            locations: { where: eq(location.isPrimary, true), limit: 1 },
          },
        },
        location: true,
      },
    });

    console.log("Looking for event id:", id);
    console.log("Found evt:", evt?.id ?? "null");

    if (!evt) {
      return new Response(JSON.stringify({ notFound: true }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Approved comments
    const comments = await db.query.eventComment.findMany({
      where: and(
        eq(eventComment.eventId, id),
        eq(eventComment.isApproved, true)
      ),
      orderBy: desc(eventComment.createdAt),
    });

    // Related events — same category or same business, exclude current
    const related = await db.query.event.findMany({
      where: and(
        ne(event.id, id),
        eq(event.isActive, true),
        gte(event.startDateTime, new Date()),
        eq(event.category, evt.category)
      ),
      orderBy: asc(event.startDateTime),
      limit: 3,
      with: {
        business: { columns: { name: true, slug: true } },
        location: { columns: { city: true, neighborhood: true } },
      },
    });

    return new Response(JSON.stringify({ evt, comments, related }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("EVENT DETAIL ERROR:", err);
    return new Response(JSON.stringify({ notFound: true }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
