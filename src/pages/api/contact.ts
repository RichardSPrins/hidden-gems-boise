import type { APIRoute } from "astro";
import { getResend } from "@/lib/resend";

const FROM =
  process.env.CONTACT_FROM_EMAIL ??
  "Hidden Gems Boise <hello@marketing.hiddengemsboise.com>";
const INBOX = process.env.CONTACT_INBOX_EMAIL;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const rawType = typeof body.type === "string" ? body.type.trim() : "";
  const type = ["nomination", "business", "press", "general"].includes(rawType)
    ? rawType
    : "general";
  const typeLabel: Record<string, string> = {
    nomination: "Nomination",
    business: "Business inquiry",
    press: "Press / partnerships",
    general: "General",
  };

  if (!name || !email || !message) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "Invalid email" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // If Resend isn't configured, log and succeed so dev/preview don't show a
  // broken form. Wire RESEND_API_KEY + CONTACT_INBOX_EMAIL to actually deliver.
  const resend = getResend();
  if (!resend || !INBOX) {
    console.warn(
      "[contact] RESEND_API_KEY or CONTACT_INBOX_EMAIL not set — message dropped.",
      { name, email, subject, length: message.length },
    );
    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }

  const lineBreaks = (s: string) => escapeHtml(s).replace(/\n/g, "<br />");
  const html = `
    <h2>${escapeHtml(typeLabel[type])} — Hidden Gems Boise</h2>
    <p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
    <p><strong>Type:</strong> ${escapeHtml(typeLabel[type])}</p>
    ${subject ? `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>` : ""}
    <p style="white-space:pre-wrap">${lineBreaks(message)}</p>
  `;

  const tagPrefix =
    type === "nomination"
      ? "Nomination"
      : type === "business"
        ? "Business"
        : type === "press"
          ? "Press"
          : "Hidden Gems";

  try {
    await resend.emails.send({
      from: FROM,
      to: INBOX,
      replyTo: email,
      subject: subject
        ? `[${tagPrefix}] ${subject}`
        : `[${tagPrefix}] ${typeLabel[type]} from ${name}`,
      html,
    });
  } catch (err) {
    console.error("[contact] resend.emails.send failed", err);
    return new Response(JSON.stringify({ error: "Could not send message" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
