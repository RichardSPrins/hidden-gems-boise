import type { APIRoute } from "astro";

// Public event submission endpoint — full implementation deferred.
// Events currently arrive only via admin/seed; no public submit path is wired yet.
export const POST: APIRoute = async () =>
  new Response(
    JSON.stringify({ error: "Not implemented" }),
    { status: 501, headers: { "Content-Type": "application/json" } }
  );
