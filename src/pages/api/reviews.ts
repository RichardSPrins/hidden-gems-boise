import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { review } from "@/lib/db/schema";

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
      headers: { "Content-Type": "application/json" },
    });
  }

  const ratingNum = parseInt(rating);
  if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return new Response(JSON.stringify({ error: "Invalid rating" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await db.insert(review).values({
    businessId,
    authorName: String(authorName).trim(),
    authorEmail: String(authorEmail).trim(),
    rating: ratingNum,
    body: reviewBody ? String(reviewBody).trim() : null,
    isApproved: false,
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
