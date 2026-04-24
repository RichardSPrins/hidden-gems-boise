import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { review, business } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { recalculateRating } from "@/lib/db/rating";

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const {
    businessId,
    authorName,
    authorEmail,
    rating,
    body: reviewBody,
  } = body;

  if (!businessId || !authorName || !authorEmail || !rating) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
    });
  }

  const ratingNum = parseInt(rating);
  if (ratingNum < 1 || ratingNum > 5) {
    return new Response(JSON.stringify({ error: "Invalid rating" }), {
      status: 400,
    });
  }

  await db.insert(review).values({
    businessId,
    authorName,
    authorEmail,
    rating: ratingNum,
    body: reviewBody ?? null,
    isApproved: false,
  });

  return new Response(JSON.stringify({ success: true }), { status: 201 });
};
