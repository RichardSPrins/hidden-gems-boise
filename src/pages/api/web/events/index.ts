// src/pages/api/web/events.ts
import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { event, business, location, category } from "@/lib/db/schema";
import { eq, and, gte, lte, asc, desc, sql, ilike, or } from "drizzle-orm";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const categoryFilter = url.searchParams.get("category") ?? "";
  const dateRange = url.searchParams.get("date") ?? "upcoming";
  const neighborhood = url.searchParams.get("neighborhood") ?? "";
  const recurring = url.searchParams.get("recurring") ?? "";
  const sort = url.searchParams.get("sort") ?? "date";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const PER_PAGE = 12;

  const now = new Date();
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + 7);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Base filters
  const filters: any[] = [
    eq(event.isActive, true),
    gte(event.startDateTime, now),
  ];

  if (q) {
    filters.push(
      or(ilike(event.title, `%${q}%`), ilike(event.description, `%${q}%`))
    );
  }

  if (categoryFilter) {
    filters.push(eq(event.category, categoryFilter as any));
  }

  if (dateRange === "week") {
    filters.push(lte(event.startDateTime, endOfWeek));
  } else if (dateRange === "month") {
    filters.push(lte(event.startDateTime, endOfMonth));
  }

  if (recurring === "true") {
    filters.push(eq(event.isRecurring, true));
  } else if (recurring === "false") {
    filters.push(eq(event.isRecurring, false));
  }

  const orderBy =
    sort === "date" ? asc(event.startDateTime) : desc(event.startDateTime);

  // Count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(event)
    .where(and(...filters));

  // Results
  const results = await db.query.event.findMany({
    where: and(...filters),
    orderBy,
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
    with: {
      business: {
        columns: { name: true, slug: true },
        with: { category: true },
      },
      location: {
        columns: { city: true, neighborhood: true, address: true },
      },
    },
  });

  // Neighborhoods from event locations
  const neighborhoodRows = await db
    .selectDistinct({ neighborhood: location.neighborhood })
    .from(location)
    .innerJoin(event, eq(event.locationId, location.id))
    .where(sql`${location.neighborhood} is not null`)
    .orderBy(location.neighborhood);

  const neighborhoods = neighborhoodRows
    .map((r) => r.neighborhood)
    .filter(Boolean) as string[];

  // All categories for sidebar
  const allCategories = await db.query.category.findMany({
    orderBy: asc(category.name),
  });

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
