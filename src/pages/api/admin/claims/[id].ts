import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { business } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/resend";
import { claimApprovedEmail, claimRejectedEmail } from "@/lib/email/templates";
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
 * Approve or reject a pending claim. Manual moderation surface for the team.
 *
 * approve → copy claimUserId into ownerId (grants portal access) + mark
 *           APPROVED. Requires a linked account (claimUserId).
 * reject  → mark REJECTED, leave ownerId null. Claimant fields are kept as a
 *           record of who tried.
 */
export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const admin = locals.user as { role?: string } | null;
  if (!admin || admin.role !== "ADMIN") return unauthorized();

  const id = params.id as string;
  if (!id) return bad("Missing id");

  const body = (await request.json()) as { action?: "approve" | "reject" };
  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return bad("action must be 'approve' or 'reject'");
  }

  const biz = await db.query.business.findFirst({
    where: eq(business.id, id),
    columns: {
      id: true,
      name: true,
      claimStatus: true,
      claimUserId: true,
      claimOwnerName: true,
      claimOwnerEmail: true,
    },
  });
  if (!biz) return bad("Listing not found", 404);
  if (biz.claimStatus !== "PENDING") {
    return bad("This claim is not pending.", 409);
  }

  if (action === "approve") {
    if (!biz.claimUserId) {
      return bad(
        "This claim has no linked account (submitted before login was required). Link an owner manually before approving.",
        422
      );
    }
    await db
      .update(business)
      .set({
        ownerId: biz.claimUserId,
        claimStatus: "APPROVED",
        updatedAt: new Date(),
      })
      .where(eq(business.id, id));

    if (biz.claimOwnerEmail) {
      const { subject, html, text } = claimApprovedEmail({
        name: biz.claimOwnerName,
        businessName: biz.name,
        url: absoluteUrl("/portal/listings"),
      });
      void sendEmail({ to: biz.claimOwnerEmail, subject, html, text });
    }
  } else {
    await db
      .update(business)
      .set({ claimStatus: "REJECTED", updatedAt: new Date() })
      .where(eq(business.id, id));

    if (biz.claimOwnerEmail) {
      const { subject, html, text } = claimRejectedEmail({
        name: biz.claimOwnerName,
        businessName: biz.name,
        url: absoluteUrl("/contact"),
      });
      void sendEmail({ to: biz.claimOwnerEmail, subject, html, text });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
