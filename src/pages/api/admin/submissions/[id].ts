import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import {
  publicSubmission,
  business,
  location,
  contactInfo,
  operatingHours,
  category,
  subcategory,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { slugify } from "@/lib/utils/slug";
import { sendSubmissionToGhl } from "@/lib/ghl";

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request, params, locals }) => {
  const user = locals.user as { role?: string } | null;
  if (!user || user.role !== "ADMIN") return unauthorized();

  const id = params.id as string;
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { action } = (await request.json()) as { action: string };

  const sub = await db.query.publicSubmission.findFirst({
    where: eq(publicSubmission.id, id),
  });
  if (!sub) {
    return new Response(JSON.stringify({ error: "Submission not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (action === "reject") {
    await db
      .update(publicSubmission)
      .set({ status: "REJECTED", reviewedAt: new Date() })
      .where(eq(publicSubmission.id, id));

    void sendSubmissionToGhl({
      event: "submission.rejected",
      submissionId: id,
      ownerName: sub.ownerName,
      ownerEmail: sub.ownerEmail,
      ownerPhone: sub.phone ?? null,
      business: {
        name: sub.businessName,
        email: sub.email,
        phone: sub.phone,
        website: sub.website,
        bio: sub.bio,
        pricePoint: sub.pricePoint,
        address: sub.address,
        city: sub.city,
        state: sub.state,
        zip: sub.zip,
        neighborhood: sub.neighborhood,
      },
      notes: sub.notes,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (action === "approve") {
    if (!sub.categoryId) {
      return new Response(
        JSON.stringify({ error: "Submission has no category — edit it first" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let candidate = slugify(sub.businessName);
    let n = 2;
    while (true) {
      const clash = await db.query.business.findFirst({
        where: eq(business.slug, candidate),
        columns: { id: true },
      });
      if (!clash) break;
      candidate = `${slugify(sub.businessName)}-${n++}`;
      if (n > 50)
        return new Response(JSON.stringify({ error: "Slug collision" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
    }

    const inserted = await db
      .insert(business)
      .values({
        name: sub.businessName,
        slug: candidate,
        categoryId: sub.categoryId,
        subcategoryId: sub.subcategoryId ?? null,
        bio: sub.bio ?? null,
        websiteUrl: sub.website ?? null,
        keywords: [],
        pricePoint: sub.pricePoint ?? null,
        status: "APPROVED",
      })
      .returning({ id: business.id });

    const businessId = inserted[0].id;

    if (sub.address && sub.city && sub.zip) {
      const insertedLoc = await db
        .insert(location)
        .values({
          businessId,
          isPrimary: true,
          address: sub.address,
          city: sub.city,
          state: sub.state || "ID",
          zip: sub.zip,
          neighborhood: sub.neighborhood ?? null,
        })
        .returning({ id: location.id });

      const defaultHours = [
        { dayOfWeek: 0, isClosed: true },
        { dayOfWeek: 1, openTime: "09:00", closeTime: "17:00", isClosed: false },
        { dayOfWeek: 2, openTime: "09:00", closeTime: "17:00", isClosed: false },
        { dayOfWeek: 3, openTime: "09:00", closeTime: "17:00", isClosed: false },
        { dayOfWeek: 4, openTime: "09:00", closeTime: "17:00", isClosed: false },
        { dayOfWeek: 5, openTime: "09:00", closeTime: "17:00", isClosed: false },
        { dayOfWeek: 6, isClosed: true },
      ];
      await db.insert(operatingHours).values(
        defaultHours.map((h) => ({
          locationId: insertedLoc[0].id,
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime ?? null,
          closeTime: h.closeTime ?? null,
          isClosed: h.isClosed,
        }))
      );
    }

    if (sub.phone || sub.email) {
      await db.insert(contactInfo).values({
        businessId,
        phone: sub.phone ?? null,
        email: sub.email ?? null,
      });
    }

    await db
      .update(publicSubmission)
      .set({ status: "APPROVED", reviewedAt: new Date() })
      .where(eq(publicSubmission.id, id));

    // Resolve category/subcategory names for GHL.
    const cat = await db.query.category.findFirst({
      where: eq(category.id, sub.categoryId),
      columns: { name: true },
    });
    const subCat = sub.subcategoryId
      ? await db.query.subcategory.findFirst({
          where: eq(subcategory.id, sub.subcategoryId),
          columns: { name: true },
        })
      : null;

    void sendSubmissionToGhl({
      event: "submission.approved",
      submissionId: id,
      businessId,
      businessSlug: candidate,
      ownerName: sub.ownerName,
      ownerEmail: sub.ownerEmail,
      ownerPhone: sub.phone ?? null,
      business: {
        name: sub.businessName,
        email: sub.email,
        phone: sub.phone,
        website: sub.website,
        bio: sub.bio,
        pricePoint: sub.pricePoint,
        address: sub.address,
        city: sub.city,
        state: sub.state,
        zip: sub.zip,
        neighborhood: sub.neighborhood,
      },
      categoryName: cat?.name ?? null,
      subcategoryName: subCat?.name ?? null,
      notes: sub.notes,
    });

    return new Response(
      JSON.stringify({ ok: true, businessId, slug: candidate }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
};
