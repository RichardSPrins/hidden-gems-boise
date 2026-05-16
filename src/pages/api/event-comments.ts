import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { eventComment } from "@/lib/db/schema";

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const {
    eventId,
    authorName,
    authorEmail,
    body: commentBody,
    rating,
  } = body;

  if (!eventId || !authorName || !authorEmail || !commentBody) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let ratingNum: number | null = null;
  if (rating !== undefined && rating !== null && rating !== "") {
    const parsed = parseInt(String(rating));
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 5) {
      return new Response(JSON.stringify({ error: "Invalid rating" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    ratingNum = parsed;
  }

  await db.insert(eventComment).values({
    eventId,
    authorName: String(authorName).trim(),
    authorEmail: String(authorEmail).trim(),
    body: String(commentBody).trim(),
    rating: ratingNum,
    isApproved: false,
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
