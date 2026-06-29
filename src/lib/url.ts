/**
 * Canonical public base URL for links that LEAVE the app — emails, webhooks,
 * anything a user clicks from outside.
 *
 * Never build these from `request.url`: behind the node adapter's reverse proxy
 * that resolves to the internal origin (e.g. http://localhost:8080), which then
 * ends up in outbound emails. Always go through the configured public origin.
 */
export function appBaseUrl(): string {
  const base =
    process.env.PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    "https://hiddengemsboise.com";
  return base.replace(/\/$/, "");
}

/** Build an absolute public URL for a path (e.g. "/portal/listings"). */
export function absoluteUrl(path: string): string {
  return `${appBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
