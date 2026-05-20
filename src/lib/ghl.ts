/**
 * GoHighLevel integration — submission/claim lifecycle events.
 *
 * Posts to a GHL Inbound Webhook configured on a workflow in the Hidden Gems
 * sub-account. Field mapping happens inside the GHL workflow UI; this file is
 * purely the transport.
 *
 * All sends are fire-and-forget: never throws into the caller, never blocks
 * the API response. If the webhook URL isn't set (e.g. local dev), the event
 * is logged and dropped.
 */

const PRICE_POINT_LABEL: Record<string, string> = {
  ONE: "$",
  TWO: "$$",
  THREE: "$$$",
  FOUR: "$$$$",
};

function appBaseUrl(): string {
  const base =
    process.env.PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    "https://hiddengemsboise.com";
  return base.replace(/\/$/, "");
}

/** Split a full name into first / last on the first whitespace boundary. */
export function splitName(full: string | null | undefined): {
  first_name: string;
  last_name: string;
} {
  const trimmed = (full ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return { first_name: "", last_name: "" };
  const parts = trimmed.split(" ");
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

/** Build a `prefix_value` tag, lowercased and underscore-separated. */
function slugTag(prefix: string, value: string | null | undefined): string | null {
  if (!value) return null;
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug ? `${prefix}_${slug}` : null;
}

export type SubmissionEvent =
  | "submission.received"
  | "submission.approved"
  | "submission.rejected"
  | "claim.received";

export interface SendSubmissionParams {
  event: SubmissionEvent;
  /** publicSubmission.id when applicable. */
  submissionId?: string;
  /** business.id when known (set after approval or for claims). */
  businessId?: string;
  /** business.slug when known — used to build a public listing URL. */
  businessSlug?: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string | null;
  business: {
    name: string;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    bio?: string | null;
    pricePoint?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    neighborhood?: string | null;
  };
  /** Resolved category name — preferred over passing IDs. */
  categoryName?: string | null;
  subcategoryName?: string | null;
  /** Free-form notes from the submitter or admin. */
  notes?: string | null;
}

/**
 * Fire a submission lifecycle event to GHL. Safe to await or not — it never
 * throws. Prefer `void sendSubmissionToGhl(...)` so the caller's response
 * isn't gated on GHL's webhook latency.
 */
export async function sendSubmissionToGhl(params: SendSubmissionParams): Promise<void> {
  const url = process.env.GHL_WEBHOOK_SUBMISSIONS_URL;
  if (!url) {
    console.warn("[ghl] GHL_WEBHOOK_SUBMISSIONS_URL not set — event dropped.", {
      event: params.event,
      submissionId: params.submissionId,
      businessId: params.businessId,
    });
    return;
  }

  const baseUrl = appBaseUrl();
  const tags = [
    `hidden_gems_${params.event.replace(".", "_")}`,
    slugTag("category", params.categoryName),
    slugTag("subcategory", params.subcategoryName),
    slugTag("city", params.business.city),
    slugTag("neighborhood", params.business.neighborhood),
  ].filter((t): t is string => Boolean(t));

  const { first_name, last_name } = splitName(params.ownerName);
  const pricePointLabel = params.business.pricePoint
    ? PRICE_POINT_LABEL[params.business.pricePoint] ?? params.business.pricePoint
    : null;

  const payload = {
    event: params.event,
    submission_id: params.submissionId,
    business_id: params.businessId,
    business_slug: params.businessSlug,
    submitted_at: new Date().toISOString(),

    owner: {
      first_name,
      last_name,
      email: params.ownerEmail,
      phone: params.ownerPhone ?? params.business.phone ?? null,
    },

    business: {
      name: params.business.name,
      email: params.business.email ?? null,
      phone: params.business.phone ?? null,
      website: params.business.website ?? null,
      bio: params.business.bio ?? null,
      category: params.categoryName ?? null,
      subcategory: params.subcategoryName ?? null,
      price_point: pricePointLabel,
      address: params.business.address ?? null,
      city: params.business.city ?? null,
      state: params.business.state ?? null,
      postal_code: params.business.zip ?? null,
      neighborhood: params.business.neighborhood ?? null,
    },

    notes: params.notes ?? null,
    source: "hiddengemsboise.com",
    tags,

    admin_url: params.submissionId
      ? `${baseUrl}/admin/submissions/${params.submissionId}`
      : params.businessId
      ? `${baseUrl}/admin/businesses/${params.businessId}`
      : null,
    listing_url: params.businessSlug
      ? `${baseUrl}/listings/${params.businessSlug}`
      : null,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("[ghl] webhook returned non-2xx", {
        status: res.status,
        event: params.event,
      });
    }
  } catch (err) {
    console.error("[ghl] webhook fetch failed", {
      err,
      event: params.event,
    });
  }
}
