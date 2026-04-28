// src/pages/api/claim.ts
import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { business } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const {
      businessId,
      verificationMethod,
      ownerName,
      ownerEmail,
      ownerPhone,
      tier,
      billingCycle,
      notes,
    } = body;

    if (
      !businessId ||
      !verificationMethod ||
      !ownerName ||
      !ownerEmail ||
      !tier
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Confirm listing is still claimable
    const biz = await db.query.business.findFirst({
      where: and(
        eq(business.id, businessId),
        eq(business.status, "APPROVED"),
        isNull(business.ownerId)
      ),
    });

    if (!biz) {
      return new Response(
        JSON.stringify({
          error: "Listing not found or not available to claim.",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if already has a pending claim
    if (biz.claimStatus === "PENDING") {
      return new Response(
        JSON.stringify({
          error: "claim_pending",
          message: "This listing already has a pending claim under review.",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Lock the listing with a pending claim
    await db
      .update(business)
      .set({
        claimStatus: "PENDING",
        claimOwnerName: ownerName.trim(),
        claimOwnerEmail: ownerEmail.trim(),
        claimOwnerPhone: ownerPhone?.trim() ?? null,
        claimVerificationMethod: verificationMethod,
        claimTier: tier,
        claimBillingCycle: billingCycle ?? "monthly",
        claimNotes: notes?.trim() ?? null,
        claimSubmittedAt: new Date(),
      })
      .where(eq(business.id, businessId));

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Claim error:", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
