// src/pages/api/submissions.ts
import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { publicSubmission, business } from "@/lib/db/schema";
import { ilike, eq, and } from "drizzle-orm";

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
      tier,
      billingCycle,
      ownerName,
      ownerEmail,
      notes,
    } = body;

    // Required field validation
    if (
      !businessName ||
      !categoryId ||
      !email ||
      !ownerName ||
      !ownerEmail ||
      !tier
    ) {
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

    // Insert into public_submission
    await db.insert(publicSubmission).values({
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
      tier,
      billingCycle: billingCycle || "monthly",
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.trim(),
      notes: notes || null,
      status: "PENDING",
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
