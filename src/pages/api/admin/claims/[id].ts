import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { business, user } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { sendEmail } from "@/lib/resend";
import {
  claimApprovedEmail,
  claimRejectedEmail,
  claimSignupInviteEmail,
} from "@/lib/email/templates";
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
 * Approve, reject, or send a sign-up invite for a pending claim. Manual
 * moderation surface for the team.
 *
 * approve → grant portal access by setting ownerId. Uses the claim's linked
 *           account (claimUserId); if there isn't one (legacy claim), links the
 *           account whose email matches the claim email. If no such account
 *           exists, it blocks and tells you to invite them to sign up.
 * reject  → mark REJECTED, leave ownerId null. Claimant fields are kept as a
 *           record of who tried.
 * invite  → email the claimant a prompt to sign up with the claim email so the
 *           claim can be linked + approved.
 */
export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const admin = locals.user as { role?: string } | null;
  if (!admin || admin.role !== "ADMIN") return unauthorized();

  const id = params.id as string;
  if (!id) return bad("Missing id");

  const body = (await request.json()) as {
    action?: "approve" | "reject" | "invite";
  };
  const action = body.action;
  if (action !== "approve" && action !== "reject" && action !== "invite") {
    return bad("action must be 'approve', 'reject' or 'invite'");
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

  if (action === "invite") {
    const email = biz.claimOwnerEmail?.trim();
    if (!email) return bad("This claim has no email to invite.", 422);
    const { subject, html, text } = claimSignupInviteEmail({
      name: biz.claimOwnerName,
      businessName: biz.name,
      // Land them on sign-up; after creating the account they return to /claim.
      url: absoluteUrl(
        `/auth/sign-up?next=${encodeURIComponent("/claim")}&email=${encodeURIComponent(email)}`,
      ),
    });
    void sendEmail({ to: email, subject, html, text });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (action === "approve") {
    // Prefer the account attached at claim time; otherwise link the account
    // whose email matches the claim email (covers legacy / no-account claims
    // once the owner has signed up with that email).
    let ownerUserId = biz.claimUserId;
    if (!ownerUserId) {
      const email = biz.claimOwnerEmail?.trim();
      if (!email) {
        return bad(
          "This claim has no account and no email to match. Reject it and ask the owner to re-claim while signed in.",
          422,
        );
      }
      const match = await db.query.user.findFirst({
        where: sql`lower(${user.email}) = ${email.toLowerCase()}`,
        columns: { id: true },
      });
      if (!match) {
        return bad(
          `No account exists for ${email} yet. Use "Invite to sign up" — once they create an account with that email, approve again to link it.`,
          422,
        );
      }
      ownerUserId = match.id;
    }

    await db
      .update(business)
      .set({
        ownerId: ownerUserId,
        claimUserId: ownerUserId, // backfill the link for the record
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
