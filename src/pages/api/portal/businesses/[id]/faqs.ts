import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { faq } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { portalUser, ownsBusiness } from "@/lib/portal";

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function forbidden() {
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Replace the full set of FAQs for an owned business. Body:
 * { faqs: [{ question, answer }] }. Order is taken from array position.
 */
export const PUT: APIRoute = async ({ request, params, locals }) => {
  const user = portalUser(locals);
  if (!user) return unauthorized();

  const businessId = params.id as string;
  if (!businessId) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!(await ownsBusiness(user.id, businessId))) return forbidden();

  const body = (await request.json()) as {
    faqs?: Array<{ question?: string; answer?: string }>;
  };
  const incoming = (Array.isArray(body.faqs) ? body.faqs : [])
    .map((f, i) => ({
      businessId,
      question: (f.question || "").trim(),
      answer: (f.answer || "").trim(),
      sortOrder: i,
    }))
    .filter((f) => f.question && f.answer);

  await db.delete(faq).where(eq(faq.businessId, businessId));
  if (incoming.length > 0) {
    await db.insert(faq).values(incoming);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
