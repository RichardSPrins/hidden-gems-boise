import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import {
  business,
  category,
  subcategory,
  location,
  image,
} from "@/lib/db/schema";
import { eq, and, ilike, or, inArray, desc, asc, sql } from "drizzle-orm";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const categorySlug = url.searchParams.get("category") ?? "";
  const subcategorySlug = url.searchParams.get("subcategory") ?? "";
  const neighborhood = url.searchParams.get("neighborhood") ?? "";
  const pricePoints = url.searchParams.getAll("price");
  const sort = url.searchParams.get("sort") ?? "rating";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const PER_PAGE = 12;

  // Fetch all categories with subcategories for sidebar
  const allCategories = await db.query.category.findMany({
    orderBy: asc(category.name),
    with: { subcategories: { orderBy: asc(subcategory.name) } },
  });

  // Build filters
  const filters: any[] = [eq(business.status, "APPROVED")];

  if (q) {
    filters.push(
      or(
        ilike(business.name, `%${q}%`),
        ilike(business.bio, `%${q}%`),
        sql`${business.keywords}::text ilike ${"%" + q + "%"}`
      )
    );
  }

  if (categorySlug) {
    const cat = allCategories.find((c) => c.slug === categorySlug);
    if (cat) filters.push(eq(business.categoryId, cat.id));
  }

  if (subcategorySlug) {
    const cat = allCategories.find((c) => c.slug === categorySlug);
    if (cat) {
      const sub = cat.subcategories.find((s) => s.slug === subcategorySlug);
      if (sub) filters.push(eq(business.subcategoryId, sub.id));
    }
  }

  if (neighborhood) {
    const locsInNeighborhood = await db
      .select({ businessId: location.businessId })
      .from(location)
      .where(eq(location.neighborhood, neighborhood));
    const ids = locsInNeighborhood.map((l) => l.businessId);
    if (ids.length > 0) filters.push(inArray(business.id, ids));
    else filters.push(sql`false`);
  }

  if (pricePoints.length > 0) {
    filters.push(inArray(business.pricePoint, pricePoints as any[]));
  }

  // Sort
  const orderBy =
    sort === "rating"
      ? desc(business.averageRating)
      : sort === "newest"
      ? desc(business.createdAt)
      : asc(business.name);

  // Count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(business)
    .where(and(...filters));

  // Results
  const results = await db.query.business.findMany({
    where: and(...filters),
    orderBy,
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
    with: {
      category: true,
      subcategory: true,
      images: { where: eq(image.isPrimary, true), limit: 1 },
      locations: { where: eq(location.isPrimary, true), limit: 1 },
      contact: true,
    },
  });

  // Neighborhoods for filter
  const neighborhoodRows = await db
    .selectDistinct({ neighborhood: location.neighborhood })
    .from(location)
    .where(sql`${location.neighborhood} is not null`)
    .orderBy(location.neighborhood);

  const neighborhoods = neighborhoodRows
    .map((r) => r.neighborhood)
    .filter(Boolean) as string[];

  return new Response(
    JSON.stringify({
      results,
      allCategories,
      neighborhoods,
      count: Number(count),
      page,
      totalPages: Math.ceil(Number(count) / PER_PAGE),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};
