import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { business, image, gemSpotlight } from "@/lib/db/schema";
import { eq, desc, isNotNull, count, sql } from "drizzle-orm";
import { getCategoriesWithSubs } from "@/lib/categories";

export const GET: APIRoute = async () => {
  const [categoriesAll, countsRaw, trending, upcomingEvents, gemRows, totalApprovedRow] =
    await Promise.all([
      // Cached canonical category list (includes icon/hero/tagline/etc).
      getCategoriesWithSubs(),

      // Live per-category APPROVED business count. Can't be cached — approvals
      // change frequently. Zipped into the category list below.
      db
        .select({
          categoryId: business.categoryId,
          businessCount: count(business.id),
        })
        .from(business)
        .where(eq(business.status, "APPROVED"))
        .groupBy(business.categoryId),

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

  const countsByCatId = new Map<string, number>(
    countsRaw.map((r) => [r.categoryId, Number(r.businessCount)])
  );
  const categories = categoriesAll.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    heroImageUrl: c.heroImageUrl,
    tagline: c.tagline,
    description: c.description,
    sortOrder: c.sortOrder,
    businessCount: countsByCatId.get(c.id) ?? 0,
  }));

  return new Response(
    JSON.stringify({
      categories,
      trending,
      upcomingEvents,
      featuredGem: featuredGem ?? null,
      previousGems,
      totalApproved,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
};
