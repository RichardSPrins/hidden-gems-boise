import { db } from "@/lib/db";
import { review, business } from "@/lib/db/schema";
import { eq, and, avg, count } from "drizzle-orm";

export async function recalculateRating(businessId: string) {
  const [result] = await db
    .select({
      avg: avg(review.rating),
      count: count(review.rating),
    })
    .from(review)
    .where(and(eq(review.businessId, businessId), eq(review.isApproved, true)));

  await db
    .update(business)
    .set({
      averageRating: result.avg ? parseFloat(result.avg) : 0,
      reviewCount: result.count ?? 0,
    })
    .where(eq(business.id, businessId));
}
