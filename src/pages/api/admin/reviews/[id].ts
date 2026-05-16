import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { review, business } from "@/lib/db/schema";
import { eq, and, avg, count } from "drizzle-orm";

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

async function recalcRating(businessId: string) {
  const [{ rating, total }] = await db
    .select({
      rating: avg(review.rating).mapWith(Number),
      total: count(review.id),
    })
    .from(review)
    .where(and(eq(review.businessId, businessId), eq(review.isApproved, true)));
  await db
    .update(business)
    .set({
      averageRating: rating ?? 0,
      reviewCount: total ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(business.id, businessId));
}

export const POST: APIRoute = async ({ request, params, locals }) => {
  const user = locals.user as { role?: string } | null;
  if (!user || user.role !== "ADMIN") return unauthorized();

  const id = params.id as string;
  const { action } = (await request.json()) as { action: "approve" | "reject" };

  const r = await db.query.review.findFirst({ where: eq(review.id, id) });
  if (!r) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (action === "approve") {
    await db
      .update(review)
      .set({ isApproved: true })
      .where(eq(review.id, id));
    await recalcRating(r.businessId);
  } else if (action === "reject") {
    await db.delete(review).where(eq(review.id, id));
    await recalcRating(r.businessId);
  } else {
    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
