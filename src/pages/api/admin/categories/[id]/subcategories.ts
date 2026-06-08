import type { APIRoute } from "astro";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { business, category, subcategory } from "@/lib/db/schema";
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

function conflict(message: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status: 409,
    headers: { "Content-Type": "application/json" },
  });
}

type IncomingSub = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  sortOrder?: number;
};

/**
 * Replace-set the subcategories for a category in a single transaction:
 * - Rows without `id` → INSERT (slug required, unique within the parent)
 * - Rows with `id` → UPDATE name/sortOrder/description (slug is locked
 *   after creation and is ignored if sent for existing rows)
 * - Existing rows missing from payload → DELETE, but only if no business
 *   references them. Otherwise the entire transaction aborts.
 */
export const PUT: APIRoute = async ({ request, params, locals }) => {
  const user = locals.user as { role?: string } | null;
  if (!user || user.role !== "ADMIN") return unauthorized();

  const categoryId = params.id as string;
  if (!categoryId) return badRequest("Missing category id");

  let body: { subcategories?: IncomingSub[] };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const incoming = Array.isArray(body.subcategories) ? body.subcategories : null;
  if (!incoming) return badRequest("subcategories must be an array");

  // Verify category exists before doing any work.
  const parent = await db.query.category.findFirst({
    where: eq(category.id, categoryId),
    columns: { id: true },
  });
  if (!parent) return badRequest("Category not found");

  // Validate the payload up front so we can reject the whole request before
  // touching the DB.
  const slugsInPayload = new Set<string>();
  const namesInPayload = new Set<string>();
  for (const row of incoming) {
    const name = row.name?.trim();
    if (!name) return badRequest("Each subcategory needs a name");

    if (namesInPayload.has(name.toLowerCase())) {
      return conflict(`Duplicate name in submitted list: "${name}".`, {
        code: "duplicate_name",
      });
    }
    namesInPayload.add(name.toLowerCase());

    if (!row.id) {
      // New row — slug is required and must be unique within this parent.
      const derivedSlug = slugify(row.slug || name);
      if (!derivedSlug) {
        return badRequest(`Could not derive a slug for "${name}"`);
      }
      if (slugsInPayload.has(derivedSlug)) {
        return conflict(
          `Duplicate slug in submitted list: "${derivedSlug}".`,
          { code: "duplicate_slug" }
        );
      }
      slugsInPayload.add(derivedSlug);
      row.slug = derivedSlug;
    }
  }

  const existing = await db.query.subcategory.findMany({
    where: eq(subcategory.categoryId, categoryId),
    columns: { id: true, slug: true, name: true },
  });
  const existingById = new Map(existing.map((s) => [s.id, s]));

  const incomingIds = new Set(
    incoming.map((r) => r.id).filter((id): id is string => Boolean(id))
  );
  const toDelete = existing.filter((s) => !incomingIds.has(s.id));

  // Pre-flight: refuse to delete any subcategory that has businesses.
  if (toDelete.length > 0) {
    const ids = toDelete.map((s) => s.id);
    const usage = await db
      .select({
        subcategoryId: business.subcategoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(business)
      .where(inArray(business.subcategoryId, ids))
      .groupBy(business.subcategoryId);
    const inUse = usage
      .filter((u) => Number(u.count) > 0)
      .map((u) => {
        const sub = toDelete.find((s) => s.id === u.subcategoryId);
        return { name: sub?.name ?? "(unknown)", count: Number(u.count) };
      });
    if (inUse.length > 0) {
      const list = inUse
        .map((u) => `"${u.name}" (${u.count})`)
        .join(", ");
      return conflict(
        `Cannot remove subcategories still in use by businesses: ${list}. Reassign or unassign them first.`,
        { code: "subcategory_in_use", inUse }
      );
    }
  }

  // Slug-uniqueness pre-check for new rows against existing rows that aren't
  // being deleted. The unique index will catch it too, but a clean 409 is
  // friendlier than a 500.
  const survivingExistingSlugs = new Set(
    existing
      .filter((s) => incomingIds.has(s.id))
      .map((s) => s.slug)
  );
  for (const row of incoming) {
    if (!row.id && row.slug && survivingExistingSlugs.has(row.slug)) {
      return conflict(
        `A subcategory with the slug "${row.slug}" already exists in this category.`,
        { code: "duplicate_slug" }
      );
    }
  }

  try {
    await db.transaction(async (tx) => {
      if (toDelete.length > 0) {
        await tx
          .delete(subcategory)
          .where(inArray(subcategory.id, toDelete.map((s) => s.id)));
      }

      for (const row of incoming) {
        const sortOrder =
          typeof row.sortOrder === "number" && Number.isFinite(row.sortOrder)
            ? Math.trunc(row.sortOrder)
            : 0;
        const description =
          typeof row.description === "string"
            ? row.description.trim() || null
            : row.description === null
            ? null
            : undefined;

        if (row.id && existingById.has(row.id)) {
          const setFields: Record<string, unknown> = {
            name: row.name!.trim(),
            sortOrder,
            updatedAt: new Date(),
          };
          if (description !== undefined) setFields.description = description;
          await tx
            .update(subcategory)
            .set(setFields)
            .where(
              and(
                eq(subcategory.id, row.id),
                eq(subcategory.categoryId, categoryId)
              )
            );
        } else {
          await tx.insert(subcategory).values({
            categoryId,
            name: row.name!.trim(),
            slug: row.slug!,
            description: description ?? null,
            sortOrder,
          });
        }
      }
    });
  } catch (err: unknown) {
    // Unique-violation fallback in case the pre-checks miss something.
    const code = (err as { code?: string })?.code;
    if (code === "23505") {
      return conflict(
        "A subcategory slug or name conflict prevented the save. Please reload and try again.",
        { code: "unique_violation" }
      );
    }
    throw err;
  }

  invalidateCategoriesCache();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
