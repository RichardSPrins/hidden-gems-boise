import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import {
  business,
  location,
  contactInfo,
  image,
  socialLink,
  operatingHours,
} from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { slugify } from "@/lib/utils/slug";

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
  const categoryId = (body.categoryId as string)?.trim();
  if (!name || !categoryId) return badRequest("name and categoryId are required");

  const baseSlug = slugify((body.slug as string) || name);
  if (!baseSlug) return badRequest("Could not derive a valid slug from the name");

  // Ensure unique slug — append -2, -3, … if needed.
  let candidate = baseSlug;
  let n = 2;
  while (true) {
    const clash = await db.query.business.findFirst({
      where: eq(business.slug, candidate),
      columns: { id: true },
    });
    if (!clash) break;
    candidate = `${baseSlug}-${n++}`;
    if (n > 50) return badRequest("Slug collision — pick a different name");
  }

  const status = (body.status as string) || "APPROVED";

  const inserted = await db
    .insert(business)
    .values({
      name,
      slug: candidate,
      categoryId,
      subcategoryId: (body.subcategoryId as string) || null,
      bio: (body.bio as string) || null,
      editorialBlurb: (body.editorialBlurb as string) || null,
      websiteUrl: (body.websiteUrl as string) || null,
      bookingUrl: (body.bookingUrl as string) || null,
      keywords: Array.isArray(body.keywords) ? (body.keywords as string[]) : [],
      pricePoint:
        (body.pricePoint as "ONE" | "TWO" | "THREE" | "FOUR" | null) || null,
      status: status as "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "SUSPENDED",
      isVerified: Boolean(body.isVerified),
      isGemOfWeek: false,
    })
    .returning({ id: business.id, slug: business.slug });

  const newId = inserted[0].id;

  // Primary location
  const loc = body.location as
    | {
        address?: string;
        city?: string;
        state?: string;
        zip?: string;
        neighborhood?: string;
        lat?: number;
        lng?: number;
      }
    | undefined;
  if (loc?.address && loc?.city && loc?.zip) {
    const insertedLoc = await db
      .insert(location)
      .values({
        businessId: newId,
        isPrimary: true,
        address: loc.address.trim(),
        city: loc.city.trim(),
        state: loc.state?.trim() || "ID",
        zip: loc.zip.trim(),
        neighborhood: loc.neighborhood?.trim() || null,
        lat: loc.lat ?? null,
        lng: loc.lng ?? null,
      })
      .returning({ id: location.id });

    // Default 7-day "open 9–5, closed Sun" so the listing has hours rendered.
    const defaultHours = [
      { dayOfWeek: 0, isClosed: true },
      { dayOfWeek: 1, openTime: "09:00", closeTime: "17:00", isClosed: false },
      { dayOfWeek: 2, openTime: "09:00", closeTime: "17:00", isClosed: false },
      { dayOfWeek: 3, openTime: "09:00", closeTime: "17:00", isClosed: false },
      { dayOfWeek: 4, openTime: "09:00", closeTime: "17:00", isClosed: false },
      { dayOfWeek: 5, openTime: "09:00", closeTime: "17:00", isClosed: false },
      { dayOfWeek: 6, isClosed: true },
    ];
    await db.insert(operatingHours).values(
      defaultHours.map((h) => ({
        locationId: insertedLoc[0].id,
        dayOfWeek: h.dayOfWeek,
        openTime: h.openTime ?? null,
        closeTime: h.closeTime ?? null,
        isClosed: h.isClosed,
      }))
    );
  }

  // Contact info (one row per business)
  const phone = (body.phone as string) || null;
  const email = (body.email as string) || null;
  if (phone || email) {
    await db.insert(contactInfo).values({
      businessId: newId,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
    });
  }

  // Primary image
  const imageUrl = (body.imageUrl as string)?.trim();
  if (imageUrl) {
    await db.insert(image).values({
      businessId: newId,
      url: imageUrl,
      alt: (body.imageAlt as string)?.trim() || name,
      isPrimary: true,
      sortOrder: 0,
    });
  }

  // Social links
  const socials = (body.socials as Array<{ platform: string; url: string }>) || [];
  for (const s of socials) {
    if (s?.platform && s?.url) {
      await db.insert(socialLink).values({
        businessId: newId,
        platform: s.platform as
          | "INSTAGRAM"
          | "FACEBOOK"
          | "TIKTOK"
          | "TWITTER"
          | "YOUTUBE"
          | "LINKEDIN"
          | "YELP"
          | "TRIPADVISOR"
          | "OTHER",
        url: s.url.trim(),
      });
    }
  }

  return new Response(
    JSON.stringify({ id: newId, slug: candidate }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};

// Sanity guard for GET so accidental browser hits don't 500.
export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user as { role?: string } | null;
  if (!user || user.role !== "ADMIN") return unauthorized();
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};

// Suppress unused-import lint without affecting behavior.
void and;
void ne;
