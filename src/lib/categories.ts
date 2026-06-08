/**
 * Cached read layer + lookup helpers for the category taxonomy.
 *
 * Every public-page render and submission-form endpoint reads its category
 * list through {@link getCategoriesWithSubs}. A module-level TTL cache keeps
 * the canonical "all categories + subcategories" query from running on every
 * request. The admin write endpoints call {@link invalidateCategoriesCache}
 * after each mutation so edits show up immediately.
 *
 * The cache is per-process. The Astro adapter runs as a single Node process
 * per instance, and the write rate on this table is effectively zero outside
 * the admin UI, so this is fine. If the app ever scales horizontally we'd
 * swap the impl here (Redis, an HTTP cache, or just a shorter TTL) — every
 * consumer goes through this module, so nothing else changes.
 */
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { category, subcategory } from "@/lib/db/schema";

export type CategoryRow = typeof category.$inferSelect;
export type SubcategoryRow = typeof subcategory.$inferSelect;
export type CategoryWithSubs = CategoryRow & { subcategories: SubcategoryRow[] };

const TTL_MS = 60_000;

let cache: { data: CategoryWithSubs[]; expiresAt: number } | null = null;

export async function getCategoriesWithSubs(): Promise<CategoryWithSubs[]> {
  if (cache && Date.now() < cache.expiresAt) return cache.data;

  const data = (await db.query.category.findMany({
    orderBy: [asc(category.sortOrder), asc(category.name)],
    with: {
      subcategories: {
        orderBy: [asc(subcategory.sortOrder), asc(subcategory.name)],
      },
    },
  })) as CategoryWithSubs[];

  cache = { data, expiresAt: Date.now() + TTL_MS };
  return data;
}

export function invalidateCategoriesCache(): void {
  cache = null;
}

export function findCategoryBySlug(
  cats: CategoryWithSubs[],
  slug: string | null | undefined
): CategoryWithSubs | null {
  if (!slug) return null;
  return cats.find((c) => c.slug === slug) ?? null;
}

export function findSubcategoryBySlug(
  cat: CategoryWithSubs | null | undefined,
  slug: string | null | undefined
): SubcategoryRow | null {
  if (!cat || !slug) return null;
  return cat.subcategories.find((s) => s.slug === slug) ?? null;
}

/**
 * Generic Boise hero used as fallback when a category has no `heroImageUrl`.
 * Matches the value previously hardcoded in
 * src/pages/explore/[category]/index.astro so behavior is unchanged for
 * categories created before the heroImageUrl field existed.
 */
export const DEFAULT_CATEGORY_HERO =
  "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1600&auto=format&fit=crop&q=80";

export function categoryHeroImage(cat: { heroImageUrl: string | null }): string {
  return cat.heroImageUrl ?? DEFAULT_CATEGORY_HERO;
}
