// src/pages/api/web/listing.ts
import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import {
  business,
  category,
  location,
  image,
  contactInfo,
  faq,
  review,
  event,
  gemSpotlight,
  amenity,
  businessAmenity,
  feature,
  businessFeature,
} from "@/lib/db/schema";
import { eq, and, ne, desc, asc, gte, sql } from "drizzle-orm";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "";

  if (!slug) {
    return new Response(JSON.stringify({ notFound: true }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Main business with all relations
  const biz = await db.query.business.findFirst({
    where: eq(business.slug, slug),
    with: {
      category: true,
      subcategory: true,
      locations: {
        with: { hours: { orderBy: asc(location.id) } },
      },
      contact: true,
      socials: true,
      images: { orderBy: [desc(image.isPrimary), asc(image.sortOrder)] },
      faqs: { orderBy: asc(faq.sortOrder) },
      features: { with: { feature: true } },
      amenities: { with: { amenity: true } },
      spotlights: {
        where: sql`published_at is not null`,
        orderBy: desc(gemSpotlight.publishedAt),
        limit: 1,
      },
    },
  });

  if (!biz) {
    return new Response(JSON.stringify({ notFound: true }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Approved reviews
  const reviews = await db.query.review.findMany({
    where: and(eq(review.businessId, biz.id), eq(review.isApproved, true)),
    orderBy: desc(review.createdAt),
  });

  // Upcoming events for this business
  const upcomingEvents = await db.query.event.findMany({
    where: and(
      eq(event.businessId, biz.id),
      eq(event.isActive, true),
      gte(event.startDateTime, new Date())
    ),
    orderBy: asc(event.startDateTime),
    limit: 5,
    with: {
      location: { columns: { city: true, neighborhood: true } },
    },
  });

  // Related businesses (same category, exclude current)
  const related = await db.query.business.findMany({
    where: and(
      eq(business.categoryId, biz.categoryId),
      ne(business.id, biz.id),
      eq(business.status, "APPROVED")
    ),
    orderBy: desc(business.averageRating),
    limit: 3,
    with: {
      category: true,
      images: { where: eq(image.isPrimary, true), limit: 1 },
      locations: { where: eq(location.isPrimary, true), limit: 1 },
    },
  });

  return new Response(
    JSON.stringify({ biz, reviews, upcomingEvents, related }),
    { headers: { "Content-Type": "application/json" } }
  );
};
