import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import {
  business,
  category,
  image,
  gemSpotlight,
} from "@/lib/db/schema";
import { eq, desc, isNotNull } from "drizzle-orm";

export const GET: APIRoute = async () => {
  const [categories, trending, upcomingEvents, gemRows] = await Promise.all([
    db.select().from(category).orderBy(category.name),

    db.query.business.findMany({
      where: eq(business.status, "APPROVED"),
      orderBy: desc(business.averageRating),
      limit: 10,
      with: {
        category: true,
        images: { where: eq(image.isPrimary, true), limit: 1 },
      },
    }),

    db.query.event.findMany({
      where: (event, { and, eq, gte }) =>
        and(eq(event.isActive, true), gte(event.startDateTime, new Date())),
      orderBy: (event) => event.startDateTime,
      limit: 10,
      with: {
        business: { columns: { name: true, slug: true } },
        location: { columns: { city: true, neighborhood: true } },
      },
    }),

    db.query.gemSpotlight.findMany({
      where: isNotNull(gemSpotlight.publishedAt),
      orderBy: desc(gemSpotlight.publishedAt),
      limit: 9,
      with: {
        business: {
          with: {
            category: { columns: { name: true } },
            images: { where: eq(image.isPrimary, true), limit: 1 },
          },
        },
      },
    }),
  ]);

  const [featuredGem, ...previousGems] = gemRows;

  return new Response(
    JSON.stringify({
      categories,
      trending,
      upcomingEvents,
      featuredGem: featuredGem ?? null,
      previousGems,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
};
