import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { category } from "@/lib/db/schema";
import { slugify } from "@/lib/utils/slug";
import { invalidateCategoriesCache } from "@/lib/categories";

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

function conflict(message: string, code?: string) {
  return new Response(JSON.stringify({ error: message, code }), {
    status: 409,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user as { role?: string } | null;
  if (!user || user.role !== "ADMIN") return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const name = (body.name as string)?.trim();
  if (!name) return badRequest("name is required");

  const slug = slugify((body.slug as string) || name);
  if (!slug) return badRequest("Could not derive a valid slug from the name");

  // Pre-check slug uniqueness so we return a clean 409 instead of a 500.
  const slugClash = await db.query.category.findFirst({
    where: eq(category.slug, slug),
    columns: { id: true },
  });
  if (slugClash) {
    return conflict(
      `A category with the slug "${slug}" already exists.`,
      "slug_in_use"
    );
  }
  const nameClash = await db.query.category.findFirst({
    where: eq(category.name, name),
    columns: { id: true },
  });
  if (nameClash) {
    return conflict(
      `A category named "${name}" already exists.`,
      "name_in_use"
    );
  }

  const sortOrderRaw = body.sortOrder;
  const sortOrder =
    typeof sortOrderRaw === "number" && Number.isFinite(sortOrderRaw)
      ? Math.trunc(sortOrderRaw)
      : 0;

  const inserted = await db
    .insert(category)
    .values({
      name,
      slug,
      heroImageUrl: ((body.heroImageUrl as string) || "").trim() || null,
      tagline: ((body.tagline as string) || "").trim() || null,
      description: ((body.description as string) || "").trim() || null,
      sortOrder,
    })
    .returning({ id: category.id, slug: category.slug });

  invalidateCategoriesCache();

  return new Response(
    JSON.stringify({ id: inserted[0].id, slug: inserted[0].slug }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};

// Sanity guard so accidental browser hits don't 500.
export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user as { role?: string } | null;
  if (!user || user.role !== "ADMIN") return unauthorized();
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
