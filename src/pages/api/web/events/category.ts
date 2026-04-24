// src/pages/api/web/events-category.ts
import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { event, location } from "@/lib/db/schema";
import {
  eq,
  and,
  gte,
  lte,
  asc,
  desc,
  sql,
  ilike,
  or,
  inArray,
} from "drizzle-orm";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const categoryValue = url.searchParams.get("categoryValue") ?? "";
  const q = url.searchParams.get("q") ?? "";
  const dateRange = url.searchParams.get("date") ?? "upcoming";
  const neighborhood = url.searchParams.get("neighborhood") ?? "";
  const recurring = url.searchParams.get("recurring") ?? "";
  const sort = url.searchParams.get("sort") ?? "date";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const PER_PAGE = 12;

  if (!categoryValue) {
    return new Response(JSON.stringify({ notFound: true }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + 7);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const filters: any[] = [
    eq(event.isActive, true),
    gte(event.startDateTime, now),
    eq(event.category, categoryValue as any),
  ];

  if (q) {
    filters.push(
      or(ilike(event.title, `%${q}%`), ilike(event.description, `%${q}%`))
    );
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

  if (neighborhood) {
    const locsInNeighborhood = await db
      .select({ id: location.id })
      .from(location)
      .where(eq(location.neighborhood, neighborhood));
    const locIds = locsInNeighborhood.map((l) => l.id);
    if (locIds.length > 0) {
      filters.push(inArray(event.locationId, locIds));
    } else {
      filters.push(sql`false`);
    }
  }

  const orderBy =
    sort === "latest" ? desc(event.startDateTime) : asc(event.startDateTime);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(event)
    .where(and(...filters));

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

  const neighborhoodRows = await db
    .selectDistinct({ neighborhood: location.neighborhood })
    .from(location)
    .innerJoin(event, eq(event.locationId, location.id))
    .where(
      and(
        sql`${location.neighborhood} is not null`,
        eq(event.category, categoryValue as any)
      )
    )
    .orderBy(location.neighborhood);

  const neighborhoods = neighborhoodRows
    .map((r) => r.neighborhood)
    .filter(Boolean) as string[];

  return new Response(
    JSON.stringify({
      results,
      neighborhoods,
      count: Number(count),
      page,
      totalPages: Math.ceil(Number(count) / PER_PAGE),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};
