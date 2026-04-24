import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { business, category, image, event, location } from "@/lib/db/schema";
import { eq, desc, gte } from "drizzle-orm";

export const GET: APIRoute = async () => {
  const [categories, trending, upcomingEvents] = await Promise.all([
    // All top-level categories
    db.select().from(category).orderBy(category.name),

    // Top rated approved businesses with primary image and category
    db.query.business.findMany({
      where: eq(business.status, "APPROVED"),
      orderBy: desc(business.averageRating),
      limit: 10,
      with: {
        category: true,
        images: {
          where: eq(image.isPrimary, true),
          limit: 1,
        },
      },
    }),

    // Upcoming active events with business and location
    db.query.event.findMany({
      where: (event, { and, eq, gte }) =>
        and(eq(event.isActive, true), gte(event.startDateTime, new Date())),
      orderBy: event.startDateTime,
      limit: 10,
      with: {
        business: {
          columns: { name: true, slug: true },
        },
        location: {
          columns: { city: true, neighborhood: true },
        },
      },
    }),
  ]);

  return new Response(
    JSON.stringify({ categories, trending, upcomingEvents }),
    { headers: { "Content-Type": "application/json" } }
  );
};
