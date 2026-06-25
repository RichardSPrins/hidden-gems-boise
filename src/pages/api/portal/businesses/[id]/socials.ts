import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { socialLink } from "@/lib/db/schema";
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

const PLATFORMS = [
  "INSTAGRAM",
  "FACEBOOK",
  "TIKTOK",
  "TWITTER",
  "YOUTUBE",
  "LINKEDIN",
  "YELP",
  "TRIPADVISOR",
  "OTHER",
] as const;
type Platform = (typeof PLATFORMS)[number];

/**
 * Replace the full set of social links for an owned business. Body:
 * { links: [{ platform, url }] }. Replace-all keeps the client trivial and
 * sidesteps the (businessId, platform) unique constraint.
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
    links?: Array<{ platform?: string; url?: string }>;
  };
  const incoming = Array.isArray(body.links) ? body.links : [];

  // Validate + dedupe by platform (last one wins).
  const byPlatform = new Map<Platform, string>();
  for (const l of incoming) {
    const platform = (l.platform || "").toUpperCase() as Platform;
    const url = (l.url || "").trim();
    if (!url) continue;
    if (!PLATFORMS.includes(platform)) {
      return new Response(
        JSON.stringify({ error: `Invalid platform: ${l.platform}` }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    byPlatform.set(platform, url);
  }

  await db.delete(socialLink).where(eq(socialLink.businessId, businessId));
  if (byPlatform.size > 0) {
    await db.insert(socialLink).values(
      [...byPlatform.entries()].map(([platform, url]) => ({
        businessId,
        platform,
        url,
      })),
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
