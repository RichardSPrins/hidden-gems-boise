// src/pages/api/web/claim-listing.ts
import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { business, location, image } from "@/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "";

  if (!slug) {
    return new Response(JSON.stringify({ notFound: true }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const biz = await db.query.business.findFirst({
    where: and(
      eq(business.slug, slug),
      eq(business.status, "APPROVED"),
      isNull(business.ownerId)
    ),
    with: {
      category: true,
      subcategory: true,
      images: { where: eq(image.isPrimary, true), limit: 1 },
      locations: { where: eq(location.isPrimary, true), limit: 1 },
      contact: true,
    },
  });

  if (!biz) {
    return new Response(JSON.stringify({ notFound: true }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check if already has a pending claim
  if (biz.claimStatus === "PENDING") {
    return new Response(JSON.stringify({ claimPending: true }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build available verification methods based on what data exists
  const verificationMethods: {
    id: string;
    label: string;
    description: string;
  }[] = [];

  if (biz.contact?.email) {
    verificationMethods.push({
      id: "email",
      label: "Email Verification",
      description: `We'll send a verification code to ${maskEmail(
        biz.contact.email
      )}`,
    });
  }

  if (biz.contact?.phone) {
    verificationMethods.push({
      id: "phone",
      label: "Phone / SMS Verification",
      description: `We'll send a code to ${maskPhone(biz.contact.phone)}`,
    });
  }

  if (biz.websiteUrl) {
    try {
      verificationMethods.push({
        id: "domain",
        label: "Website / Domain Verification",
        description: `Prove ownership of ${new URL(biz.websiteUrl).hostname}`,
      });
    } catch {}
  }

  // Manual always available as fallback
  verificationMethods.push({
    id: "manual",
    label: "Manual Review",
    description:
      "Submit your claim and we'll verify ownership directly with you.",
  });

  // Strip sensitive data before sending to client
  const safeBiz = {
    id: biz.id,
    name: biz.name,
    slug: biz.slug,
    bio: biz.bio,
    categoryName: biz.category?.name,
    subcategoryName: biz.subcategory?.name,
    neighborhood: biz.locations?.[0]?.neighborhood,
    city: biz.locations?.[0]?.city,
    image: biz.images?.[0]?.url,
  };

  return new Response(JSON.stringify({ biz: safeBiz, verificationMethods }), {
    headers: { "Content-Type": "application/json" },
  });
};

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: string) {
  return phone.replace(/\d(?=\d{4})/g, "*");
}
