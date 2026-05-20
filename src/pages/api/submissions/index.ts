// src/pages/api/submissions.ts
import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { publicSubmission, business, category, subcategory } from "@/lib/db/schema";
import { ilike, eq, and } from "drizzle-orm";
import { sendSubmissionToGhl } from "@/lib/ghl";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const {
      businessName,
      categoryId,
      subcategoryId,
      website,
      phone,
      email,
      address,
      city,
      state,
      zip,
      neighborhood,
      bio,
      pricePoint,
      ownerName,
      ownerEmail,
      notes,
    } = body;

    // Required field validation
    if (!businessName || !categoryId || !email || !ownerName || !ownerEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Duplicate check — existing approved business with same name
    const existingBusiness = await db.query.business.findFirst({
      where: ilike(business.name, businessName.trim()),
    });

    if (existingBusiness) {
      return new Response(
        JSON.stringify({
          error: "duplicate_business",
          message: `A listing for "${businessName}" already exists. If this is your business, you can claim it instead.`,
          slug: existingBusiness.slug,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Duplicate check — pending public submission with same name
    const existingSubmission = await db.query.publicSubmission.findFirst({
      where: and(
        ilike(publicSubmission.businessName, businessName.trim()),
        eq(publicSubmission.status, "PENDING")
      ),
    });

    if (existingSubmission) {
      return new Response(
        JSON.stringify({
          error: "duplicate_submission",
          message: `A submission for "${businessName}" is already pending review. We'll be in touch soon.`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Insert into public_submission. tier/billingCycle are internal-only fields
    // managed by admin if/when a business is upgraded to premium out-of-band —
    // they're never collected from the public submission form.
    const inserted = await db
      .insert(publicSubmission)
      .values({
        businessName: businessName.trim(),
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        website: website || null,
        phone: phone || null,
        email: email.trim(),
        address: address || null,
        city: city || null,
        state: state || "ID",
        zip: zip || null,
        neighborhood: neighborhood || null,
        bio: bio || null,
        pricePoint: pricePoint || null,
        tier: "FREE",
        billingCycle: "monthly",
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
        notes: notes || null,
        status: "PENDING",
      })
      .returning({ id: publicSubmission.id });

    // Resolve category/subcategory names for GHL — best-effort, never blocks.
    let categoryName: string | null = null;
    let subcategoryName: string | null = null;
    if (categoryId) {
      const cat = await db.query.category.findFirst({
        where: eq(category.id, categoryId),
        columns: { name: true },
      });
      categoryName = cat?.name ?? null;
    }
    if (subcategoryId) {
      const sub = await db.query.subcategory.findFirst({
        where: eq(subcategory.id, subcategoryId),
        columns: { name: true },
      });
      subcategoryName = sub?.name ?? null;
    }

    // Fire-and-forget GHL event. Don't await — the user's response shouldn't
    // be gated on the webhook round-trip.
    void sendSubmissionToGhl({
      event: "submission.received",
      submissionId: inserted[0]?.id,
      ownerName,
      ownerEmail,
      ownerPhone: phone ?? null,
      business: {
        name: businessName,
        email: email,
        phone: phone ?? null,
        website: website ?? null,
        bio: bio ?? null,
        pricePoint: pricePoint ?? null,
        address: address ?? null,
        city: city ?? null,
        state: state ?? "ID",
        zip: zip ?? null,
        neighborhood: neighborhood ?? null,
      },
      categoryName,
      subcategoryName,
      notes: notes ?? null,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Submission error:", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
