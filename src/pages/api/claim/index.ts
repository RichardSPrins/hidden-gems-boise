// src/pages/api/claim.ts
import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { business } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { sendSubmissionToGhl } from "@/lib/ghl";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const {
      businessId,
      verificationMethod,
      ownerName,
      ownerEmail,
      ownerPhone,
      notes,
    } = body;

    if (
      !businessId ||
      !verificationMethod ||
      !ownerName ||
      !ownerEmail
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Confirm listing is still claimable. Eager-load category + primary
    // location + contact so the GHL event has the full business snapshot.
    const biz = await db.query.business.findFirst({
      where: and(
        eq(business.id, businessId),
        eq(business.status, "APPROVED"),
        isNull(business.ownerId)
      ),
      with: {
        category: { columns: { name: true } },
        subcategory: { columns: { name: true } },
        locations: { limit: 1 },
        contact: true,
      },
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

    // Lock the listing with a pending claim. claimTier/claimBillingCycle stay
    // null on claim — premium upgrade is an admin-initiated flow that happens
    // out-of-band (via outreach) after the claim is approved.
    await db
      .update(business)
      .set({
        claimStatus: "PENDING",
        claimOwnerName: ownerName.trim(),
        claimOwnerEmail: ownerEmail.trim(),
        claimOwnerPhone: ownerPhone?.trim() ?? null,
        claimVerificationMethod: verificationMethod,
        claimNotes: notes?.trim() ?? null,
        claimSubmittedAt: new Date(),
      })
      .where(eq(business.id, businessId));

    const primaryLocation = biz.locations?.[0];
    void sendSubmissionToGhl({
      event: "claim.received",
      businessId: biz.id,
      businessSlug: biz.slug,
      ownerName,
      ownerEmail,
      ownerPhone: ownerPhone?.trim() ?? null,
      business: {
        name: biz.name,
        email: biz.contact?.email ?? null,
        phone: biz.contact?.phone ?? null,
        website: biz.websiteUrl ?? null,
        bio: biz.bio ?? null,
        pricePoint: biz.pricePoint ?? null,
        address: primaryLocation?.address ?? null,
        city: primaryLocation?.city ?? null,
        state: primaryLocation?.state ?? null,
        zip: primaryLocation?.zip ?? null,
        neighborhood: primaryLocation?.neighborhood ?? null,
      },
      categoryName: biz.category?.name ?? null,
      subcategoryName: biz.subcategory?.name ?? null,
      notes: notes ?? null,
    });

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
