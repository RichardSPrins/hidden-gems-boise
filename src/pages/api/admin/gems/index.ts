import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { gemSpotlight, business } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user as { role?: string } | null;
  if (!user || user.role !== "ADMIN") return unauthorized();

  const body = await request.json();
  const businessId = (body.businessId as string)?.trim();
  const headline = (body.headline as string)?.trim();
  const writeup = (body.writeup as string)?.trim();
  const weekLabel = (body.weekLabel as string)?.trim();
  const shortDescriptionRaw = typeof body.shortDescription === "string" ? body.shortDescription.trim() : "";
  const shortDescription = shortDescriptionRaw.length > 0 ? shortDescriptionRaw : null;
  const publish = Boolean(body.publish);

  if (!businessId || !headline || !writeup || !weekLabel) {
    return new Response(
      JSON.stringify({ error: "businessId, headline, writeup, weekLabel required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const inserted = await db
    .insert(gemSpotlight)
    .values({
      businessId,
      headline,
      shortDescription,
      writeup,
      weekLabel,
      publishedAt: publish ? new Date() : null,
    })
    .returning({ id: gemSpotlight.id });

  if (publish) {
    await db
      .update(business)
      .set({
        isGemOfWeek: true,
        gemWeekDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(business.id, businessId));
  }

  return new Response(JSON.stringify({ id: inserted[0].id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
