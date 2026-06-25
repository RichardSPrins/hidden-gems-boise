/**
 * Portal ownership helpers. The business portal is gated by *ownership*, not by
 * admin role: a user may only read/write a business whose `ownerId` is their
 * own id, and any child rows (locations, images, events) that hang off it.
 *
 * Every /api/portal/* route should resolve the acting user from `locals.user`
 * and run the target id through one of these guards before mutating anything.
 */
import { db } from "@/lib/db";
import { business, location, image, event } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export interface PortalUser {
  id: string;
  email?: string;
  name?: string | null;
}

/** Narrow `locals.user` to a portal user, or null if not signed in. */
export function portalUser(locals: App.Locals): PortalUser | null {
  const u = locals.user as PortalUser | null;
  return u && u.id ? u : null;
}

/**
 * Full business (with the relations the portal edit screens need) — but only
 * if owned by `userId`. Returns null when missing or not owned.
 */
export async function getOwnedBusiness(userId: string, businessId: string) {
  const biz = await db.query.business.findFirst({
    where: and(eq(business.id, businessId), eq(business.ownerId, userId)),
    with: {
      category: true,
      subcategory: true,
      locations: { with: { hours: true } },
      contact: true,
      socials: true,
      images: true,
      faqs: true,
    },
  });
  return biz ?? null;
}

/** All businesses owned by a user — for the portal listings index. */
export async function listOwnedBusinesses(userId: string) {
  return db.query.business.findMany({
    where: eq(business.ownerId, userId),
    with: {
      category: { columns: { name: true } },
      images: { columns: { url: true, isPrimary: true } },
    },
  });
}

/** Lightweight ownership check by business id. */
export async function ownsBusiness(
  userId: string,
  businessId: string,
): Promise<boolean> {
  const row = await db.query.business.findFirst({
    where: and(eq(business.id, businessId), eq(business.ownerId, userId)),
    columns: { id: true },
  });
  return Boolean(row);
}

/** Resolve a location and confirm its business is owned by the user. */
export async function getOwnedLocation(userId: string, locationId: string) {
  const row = await db.query.location.findFirst({
    where: eq(location.id, locationId),
    with: { business: { columns: { ownerId: true } }, hours: true },
  });
  if (!row || row.business?.ownerId !== userId) return null;
  return row;
}

/** Resolve an image and confirm its business is owned by the user. */
export async function getOwnedImage(userId: string, imageId: string) {
  const row = await db.query.image.findFirst({
    where: eq(image.id, imageId),
    with: { business: { columns: { ownerId: true } } },
  });
  if (!row || row.business?.ownerId !== userId) return null;
  return row;
}

/** Resolve an event and confirm its business is owned by the user. */
export async function getOwnedEvent(userId: string, eventId: string) {
  const row = await db.query.event.findFirst({
    where: eq(event.id, eventId),
    with: { business: { columns: { ownerId: true, name: true } } },
  });
  if (!row || row.business?.ownerId !== userId) return null;
  return row;
}
