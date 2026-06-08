import type { APIRoute } from "astro";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { business, category } from "@/lib/db/schema";
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

function conflict(message: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status: 409,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Editable columns on category. Slug is intentionally excluded — slugs are
 * locked after creation per product decision (renaming requires recreate +
 * reassign).
 */
const EDITABLE_FIELDS = [
  "name",
  "heroImageUrl",
  "tagline",
  "description",
  "sortOrder",
] as const;

export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const user = locals.user as { role?: string } | null;
  if (!user || user.role !== "ADMIN") return unauthorized();

  const id = params.id as string;
  if (!id) return badRequest("Missing id");

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  if ("slug" in body) {
    return badRequest(
      "Slugs are locked after creation. To rename, create a new category and reassign businesses."
    );
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const f of EDITABLE_FIELDS) {
    if (!(f in body)) continue;
    const raw = body[f];
    if (f === "sortOrder") {
      const n = typeof raw === "number" ? Math.trunc(raw) : Number(raw);
      updates[f] = Number.isFinite(n) ? n : 0;
    } else if (typeof raw === "string") {
      const trimmed = raw.trim();
      updates[f] = trimmed || null;
    } else if (raw === null) {
      updates[f] = null;
    }
  }

  // Name uniqueness check — only when name is actually changing.
  if (typeof updates.name === "string") {
    const clash = await db.query.category.findFirst({
      where: and(eq(category.name, updates.name as string), ne(category.id, id)),
      columns: { id: true },
    });
    if (clash) {
      return conflict(`A category named "${updates.name}" already exists.`, {
        code: "name_in_use",
      });
    }
  }

  await db.update(category).set(updates).where(eq(category.id, id));
  invalidateCategoriesCache();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user as { role?: string } | null;
  if (!user || user.role !== "ADMIN") return unauthorized();

  const id = params.id as string;
  if (!id) return badRequest("Missing id");

  // FK on business.categoryId is NOT NULL — deletes will fail at the DB
  // level. Pre-check so we can return a structured message the admin UI can
  // show inline instead of a 500.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(business)
    .where(eq(business.categoryId, id));

  if (Number(count) > 0) {
    return conflict(
      `${count} ${
        Number(count) === 1 ? "business uses" : "businesses use"
      } this category. Reassign them on the businesses list first.`,
      { code: "in_use", businessCount: Number(count) }
    );
  }

  await db.delete(category).where(eq(category.id, id));
  invalidateCategoriesCache();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
