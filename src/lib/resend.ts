import { Resend } from "resend";

let client: Resend | null = null;

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

const DEFAULT_FROM = "Hidden Gems Boise <hello@mail.hiddengemsboise.com>";
const AUTH_FROM =
  process.env.AUTH_FROM_EMAIL ?? "Hidden Gems Boise <auth@mail.hiddengemsboise.com>";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  /** "auth" picks the auth-from address; default falls back to general transactional. */
  kind?: "auth" | "transactional";
}

/**
 * Send a transactional email via Resend. Resolves silently in dev when the API
 * key is missing — the message is logged so flows don't appear broken locally.
 * Never throws into the caller; auth flows mustn't break because email is down.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const { to, subject, html, text, replyTo, kind, from } = input;
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — message dropped.", {
      to,
      subject,
    });
    return;
  }

  const sender =
    from ?? (kind === "auth" ? AUTH_FROM : process.env.CONTACT_FROM_EMAIL ?? DEFAULT_FROM);

  try {
    await resend.emails.send({
      from: sender,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
      ...(replyTo ? { replyTo } : {}),
    });
  } catch (err) {
    console.error("[email] send failed", { to, subject, err });
  }
}
