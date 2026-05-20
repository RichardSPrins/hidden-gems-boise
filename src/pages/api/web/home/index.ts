import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import {
  business,
  category,
  image,
  gemSpotlight,
} from "@/lib/db/schema";
import { eq, desc, isNotNull, count, sql } from "drizzle-orm";

export const GET: APIRoute = async () => {
  const [categoriesRaw, trending, upcomingEvents, gemRows, totalApprovedRow] =
    await Promise.all([
      // Categories with live count of APPROVED businesses per category.
      db
        .select({
          id: category.id,
          name: category.name,
          slug: category.slug,
          businessCount: count(business.id),
        })
        .from(category)
        .leftJoin(
          business,
          sql`${business.categoryId} = ${category.id} AND ${business.status} = 'APPROVED'`,
        )
        .groupBy(category.id, category.name, category.slug)
        .orderBy(category.name),

      // Featured / Local Favorites — prefer businesses with an editorial blurb,
      // then by rating. Falls back to top-rated if blurbs are sparse.
      db.query.business.findMany({
        where: eq(business.status, "APPROVED"),
        orderBy: [
          sql`CASE WHEN ${business.editorialBlurb} IS NOT NULL AND LENGTH(${business.editorialBlurb}) > 0 THEN 0 ELSE 1 END`,
          desc(business.averageRating),
        ],
        limit: 12,
        with: {
          category: true,
          locations: { limit: 1, columns: { neighborhood: true, city: true } },
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

      // Total approved listings — used in the hero subhead.
      db
        .select({ total: count() })
        .from(business)
        .where(eq(business.status, "APPROVED")),
    ]);

  const [featuredGem, ...previousGems] = gemRows;
  const totalApproved = totalApprovedRow[0]?.total ?? 0;

  return new Response(
    JSON.stringify({
      categories: categoriesRaw,
      trending,
      upcomingEvents,
      featuredGem: featuredGem ?? null,
      previousGems,
      totalApproved,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
};
