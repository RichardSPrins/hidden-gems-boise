import { sendEmail } from "@/lib/resend";

/** The team inbox that receives operational notifications (claims, events). */
export function adminInbox(): string | null {
  return process.env.CONTACT_INBOX_EMAIL || null;
}

/**
 * Send an operational notification to the team inbox. No-ops (with a warning)
 * when CONTACT_INBOX_EMAIL is unset, mirroring how the contact form behaves so
 * local dev doesn't appear broken. Never throws into the caller.
 */
export async function notifyAdmin(payload: {
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const to = adminInbox();
  if (!to) {
    console.warn(
      "[notify] CONTACT_INBOX_EMAIL not set — admin notification dropped.",
      { subject: payload.subject },
    );
    return;
  }
  await sendEmail({ to, ...payload, kind: "transactional" });
}
