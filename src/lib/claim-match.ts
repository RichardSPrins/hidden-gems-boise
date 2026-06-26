/**
 * Heuristic ownership signal for the admin claims queue. A claim is self-
 * attested, so we surface whether the claimant's email lines up with channels
 * already tied to the business — an exact match to the listing's on-file
 * contact email (strongest) or a domain match to the business website. This is
 * a hint to speed up manual review, not an automated gate.
 */

function emailDomain(email?: string | null): string | null {
  if (!email) return null;
  const parts = email.toLowerCase().trim().split("@");
  return parts.length === 2 && parts[1] ? parts[1] : null;
}

function urlHost(url?: string | null): string | null {
  if (!url) return null;
  let u = url.trim().toLowerCase();
  if (!u) return null;
  if (!/^https?:\/\//.test(u)) u = `https://${u}`;
  try {
    const host = new URL(u).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

export type ClaimMatchLevel = "email" | "domain" | "none";
export interface ClaimMatch {
  level: ClaimMatchLevel;
  label: string;
}

export function claimMatch(input: {
  claimEmail?: string | null;
  accountEmail?: string | null;
  contactEmail?: string | null;
  websiteUrl?: string | null;
}): ClaimMatch {
  const candidates = [input.claimEmail, input.accountEmail]
    .map((e) => e?.toLowerCase().trim())
    .filter((e): e is string => Boolean(e));
  const contact = input.contactEmail?.toLowerCase().trim() || null;

  // Strongest: claimant email exactly equals the listing's on-file contact.
  if (contact && candidates.includes(contact)) {
    return { level: "email", label: "Email matches listing" };
  }

  // Next: claimant email domain matches the website host (or contact domain).
  const targetDomains = new Set(
    [urlHost(input.websiteUrl), emailDomain(contact)].filter(
      (d): d is string => Boolean(d),
    ),
  );
  if (targetDomains.size) {
    for (const c of candidates) {
      const d = emailDomain(c);
      if (d && targetDomains.has(d)) {
        return { level: "domain", label: "Domain matches business" };
      }
    }
  }

  return { level: "none", label: "Verify manually" };
}
