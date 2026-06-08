// src/pages/api/submissions/form-data.ts
import type { APIRoute } from "astro";
import { getCategoriesWithSubs } from "@/lib/categories";

export const GET: APIRoute = async () => {
  const categories = await getCategoriesWithSubs();
  return new Response(JSON.stringify({ categories }), {
    headers: { "Content-Type": "application/json" },
  });
};
