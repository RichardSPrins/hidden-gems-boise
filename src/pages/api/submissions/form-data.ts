// src/pages/api/submissions/form-data.ts
import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { category, subcategory } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export const GET: APIRoute = async () => {
  const categories = await db.query.category.findMany({
    orderBy: asc(category.name),
    with: {
      subcategories: { orderBy: asc(subcategory.name) },
    },
  });

  return new Response(JSON.stringify({ categories }), {
    headers: { "Content-Type": "application/json" },
  });
};
