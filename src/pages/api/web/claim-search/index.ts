// src/pages/api/web/claim-search.ts
import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { business, location, image } from "@/lib/db/schema";
import { ilike, eq, and, isNull, asc } from "drizzle-orm";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";

  if (!q || q.length < 2) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const results = await db.query.business.findMany({
    where: and(
      eq(business.status, "APPROVED"),
      isNull(business.ownerId),
      isNull(business.claimStatus),
      ilike(business.name, `%${q}%`)
    ),
    orderBy: asc(business.name),
    limit: 10,
    with: {
      category: true,
      images: { where: eq(image.isPrimary, true), limit: 1 },
      locations: { where: eq(location.isPrimary, true), limit: 1 },
    },
  });

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" },
  });
};
