import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { event } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/resend";
import { eventApprovedEmail } from "@/lib/email/templates";
import { absoluteUrl } from "@/lib/url";

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Approve / unpublish an event. Body: { isActive: boolean }. On approve, email
 * the owner that it's live.
 */
export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const admin = locals.user as { role?: string } | null;
  if (!admin || admin.role !== "ADMIN") return unauthorized();

  const id = params.id as string;
  if (!id) return bad("Missing id");

  const body = (await request.json()) as { isActive?: boolean };
  if (typeof body.isActive !== "boolean") return bad("isActive (boolean) required");

  const existing = await db.query.event.findFirst({
    where: eq(event.id, id),
    columns: { id: true, title: true, isActive: true },
    with: { business: { with: { owner: { columns: { email: true, name: true } } } } },
  });
  if (!existing) return bad("Event not found", 404);

  await db
    .update(event)
    .set({ isActive: body.isActive, updatedAt: new Date() })
    .where(eq(event.id, id));

  // Email the owner only on the false→true transition (newly approved).
  if (body.isActive && !existing.isActive && existing.business?.owner?.email) {
    const { subject, html, text } = eventApprovedEmail({
      name: existing.business.owner.name,
      eventTitle: existing.title,
      url: absoluteUrl("/portal/events"),
    });
    void sendEmail({ to: existing.business.owner.email, subject, html, text });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
