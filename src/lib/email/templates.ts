/**
 * Plain, no-dependency email templates. Inline styles only — most email
 * clients strip <style> blocks and don't load external CSS.
 *
 * Layout philosophy: single-column, max 560px, readable on phones. The brand
 * shows up as a one-line wordmark; the dominant element is always the CTA.
 */

interface TemplatePayload {
  subject: string;
  html: string;
  text: string;
}

interface EmailContext {
  name?: string | null;
  url: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function wrap(opts: { preheader: string; bodyHtml: string }): string {
  const preheader = escapeHtml(opts.preheader);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Hidden Gems Boise</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f2ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;">
    <div style="display:none;max-height:0;overflow:hidden;color:#f5f2ee;">${preheader}</div>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:32px 16px;background:#f5f2ee;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e4e0da;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:600;letter-spacing:-0.01em;color:#1a1a1a;">
                  Hidden <span style="color:#c9a84c;">Gems</span> Boise
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px 32px;font-size:15px;line-height:1.6;color:#1a1a1a;">
                ${opts.bodyHtml}
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-size:12px;color:#9a9a9a;text-align:center;">
            Hidden Gems Boise · hiddengemsboise.com
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function ctaButton(label: string, url: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
    <tr>
      <td bgcolor="#c9a84c" style="border-radius:8px;">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#0d0d0d;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

function greeting(name?: string | null): string {
  const first = (name?.trim().split(/\s+/)[0]) ?? "";
  return first ? `Hi ${escapeHtml(first)},` : "Hi,";
}

export function passwordResetEmail(ctx: EmailContext): TemplatePayload {
  const { url, name } = ctx;
  const subject = "Reset your Hidden Gems Boise password";
  const html = wrap({
    preheader: "Use the link inside to set a new password. Expires in 1 hour.",
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${greeting(name)}</p>
      <p style="margin:0 0 16px 0;">We got a request to reset the password on your Hidden Gems Boise account. Click the button below to set a new one.</p>
      ${ctaButton("Reset password", url)}
      <p style="margin:0 0 8px 0;font-size:13px;color:#6b6b6b;">If the button doesn't work, paste this link into your browser:</p>
      <p style="margin:0 0 16px 0;font-size:13px;color:#6b6b6b;word-break:break-all;"><a href="${escapeHtml(url)}" style="color:#c9a84c;">${escapeHtml(url)}</a></p>
      <p style="margin:24px 0 0 0;font-size:13px;color:#6b6b6b;">This link expires in 1 hour. If you didn't ask for a reset, you can safely ignore this email — your password won't change.</p>
    `,
  });
  const text = [
    greeting(name).replace(/<[^>]+>/g, ""),
    "",
    "We got a request to reset the password on your Hidden Gems Boise account.",
    "Use this link to set a new one:",
    url,
    "",
    "This link expires in 1 hour. If you didn't ask for a reset, you can ignore this email.",
  ].join("\n");
  return { subject, html, text };
}

export function verifyEmailEmail(ctx: EmailContext): TemplatePayload {
  const { url, name } = ctx;
  const subject = "Confirm your email — Hidden Gems Boise";
  const html = wrap({
    preheader: "One click to confirm your email and finish setting up your account.",
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${greeting(name)}</p>
      <p style="margin:0 0 16px 0;">Welcome to Hidden Gems Boise — Boise's curated directory of independently owned businesses. Confirm your email to finish setting up your account.</p>
      ${ctaButton("Confirm my email", url)}
      <p style="margin:0 0 8px 0;font-size:13px;color:#6b6b6b;">If the button doesn't work, paste this link into your browser:</p>
      <p style="margin:0 0 16px 0;font-size:13px;color:#6b6b6b;word-break:break-all;"><a href="${escapeHtml(url)}" style="color:#c9a84c;">${escapeHtml(url)}</a></p>
      <p style="margin:24px 0 0 0;font-size:13px;color:#6b6b6b;">If you didn't sign up, you can ignore this email and the account won't be activated.</p>
    `,
  });
  const text = [
    greeting(name).replace(/<[^>]+>/g, ""),
    "",
    "Welcome to Hidden Gems Boise. Confirm your email to finish setting up your account:",
    url,
    "",
    "If you didn't sign up, you can ignore this email.",
  ].join("\n");
  return { subject, html, text };
}

// ─────────────────────────────────────────────────────────────
// CLAIMS
// ─────────────────────────────────────────────────────────────

interface ClaimAdminNotifyContext {
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string | null;
  accountEmail?: string | null;
  verificationMethod?: string | null;
  notes?: string | null;
  /** Link to the admin claims queue. */
  url: string;
}

/** Sent to the team inbox when a new claim is submitted and needs review. */
export function claimSubmittedAdminEmail(
  ctx: ClaimAdminNotifyContext,
): TemplatePayload {
  const {
    businessName,
    ownerName,
    ownerEmail,
    ownerPhone,
    accountEmail,
    verificationMethod,
    notes,
    url,
  } = ctx;
  const subject = `New claim: ${businessName}`;
  const rows: Array<[string, string | null | undefined]> = [
    ["Business", businessName],
    ["Claimant", ownerName],
    ["Claim email", ownerEmail],
    ["Phone", ownerPhone],
    ["Logged-in account", accountEmail],
    ["Verification", verificationMethod],
    ["Notes", notes],
  ];
  const rowsHtml = rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b6b6b;vertical-align:top;">${escapeHtml(
          k,
        )}</td><td style="padding:4px 0;">${escapeHtml(String(v))}</td></tr>`,
    )
    .join("");
  const html = wrap({
    preheader: `${ownerName} wants to claim ${businessName}.`,
    bodyHtml: `
      <p style="margin:0 0 16px 0;">A business owner submitted a claim awaiting review.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="font-size:14px;">${rowsHtml}</table>
      ${ctaButton("Review claim", url)}
    `,
  });
  const text = [
    `New claim: ${businessName}`,
    "",
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    "",
    `Review: ${url}`,
  ].join("\n");
  return { subject, html, text };
}

interface ClaimDecisionContext {
  name?: string | null;
  businessName: string;
  /** Link to the portal listings page. */
  url: string;
}

/** Sent to the owner when their claim is approved. */
export function claimApprovedEmail(ctx: ClaimDecisionContext): TemplatePayload {
  const { name, businessName, url } = ctx;
  const subject = `Your claim for ${businessName} is approved`;
  const html = wrap({
    preheader: `You can now manage ${businessName} on Hidden Gems Boise.`,
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${greeting(name)}</p>
      <p style="margin:0 0 16px 0;">Good news — your claim for <strong>${escapeHtml(
        businessName,
      )}</strong> has been approved. You can now manage your listing: update details, hours, photos, and events.</p>
      ${ctaButton("Manage my listing", url)}
    `,
  });
  const text = [
    greeting(name).replace(/<[^>]+>/g, ""),
    "",
    `Your claim for ${businessName} has been approved. Manage your listing:`,
    url,
  ].join("\n");
  return { subject, html, text };
}

/** Sent to the owner when their claim is rejected. */
export function claimRejectedEmail(ctx: ClaimDecisionContext): TemplatePayload {
  const { name, businessName, url } = ctx;
  const subject = `Update on your claim for ${businessName}`;
  const html = wrap({
    preheader: `We couldn't verify your claim for ${businessName}.`,
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${greeting(name)}</p>
      <p style="margin:0 0 16px 0;">We weren't able to verify your claim for <strong>${escapeHtml(
        businessName,
      )}</strong> at this time. If you believe this is a mistake, reply to this email with more detail and we'll take another look.</p>
      ${ctaButton("Contact us", url)}
    `,
  });
  const text = [
    greeting(name).replace(/<[^>]+>/g, ""),
    "",
    `We weren't able to verify your claim for ${businessName}. Reply with more detail and we'll take another look.`,
    url,
  ].join("\n");
  return { subject, html, text };
}

/** Sent to a claimant who has no account yet, prompting them to sign up. */
export function claimSignupInviteEmail(
  ctx: ClaimDecisionContext,
): TemplatePayload {
  const { name, businessName, url } = ctx;
  const subject = `Finish claiming ${businessName} — create your account`;
  const html = wrap({
    preheader: `Create your account to manage ${businessName} on Hidden Gems Boise.`,
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${greeting(name)}</p>
      <p style="margin:0 0 16px 0;">Thanks for claiming <strong>${escapeHtml(
        businessName,
      )}</strong> on Hidden Gems Boise. To finish, create a free account using <em>this same email address</em> — that's how we connect the claim to you.</p>
      ${ctaButton("Create my account", url)}
      <p style="margin:24px 0 0 0;font-size:13px;color:#6b6b6b;">Once your account is set up, we'll review and activate your claim. Be sure to sign up with the email this message was sent to.</p>
    `,
  });
  const text = [
    greeting(name).replace(/<[^>]+>/g, ""),
    "",
    `Thanks for claiming ${businessName}. Create a free account using THIS SAME email address to finish:`,
    url,
    "",
    "Once your account is set up, we'll review and activate your claim.",
  ].join("\n");
  return { subject, html, text };
}

// ─────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────

interface EventAdminNotifyContext {
  businessName: string;
  eventTitle: string;
  /** Link to the admin events queue. */
  url: string;
}

/** Sent to the team inbox when an owner submits an event for review. */
export function eventSubmittedAdminEmail(
  ctx: EventAdminNotifyContext,
): TemplatePayload {
  const { businessName, eventTitle, url } = ctx;
  const subject = `New event: ${eventTitle} (${businessName})`;
  const html = wrap({
    preheader: `${businessName} submitted "${eventTitle}" for review.`,
    bodyHtml: `
      <p style="margin:0 0 16px 0;"><strong>${escapeHtml(
        businessName,
      )}</strong> submitted an event awaiting review:</p>
      <p style="margin:0 0 16px 0;font-size:16px;">${escapeHtml(eventTitle)}</p>
      ${ctaButton("Review event", url)}
    `,
  });
  const text = [
    `New event: ${eventTitle} (${businessName})`,
    "",
    `Review: ${url}`,
  ].join("\n");
  return { subject, html, text };
}

interface EventApprovedContext {
  name?: string | null;
  eventTitle: string;
  /** Link to the portal events page. */
  url: string;
}

/** Sent to the owner when their event is approved and goes live. */
export function eventApprovedEmail(ctx: EventApprovedContext): TemplatePayload {
  const { name, eventTitle, url } = ctx;
  const subject = `Your event "${eventTitle}" is live`;
  const html = wrap({
    preheader: `"${eventTitle}" is now published on Hidden Gems Boise.`,
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${greeting(name)}</p>
      <p style="margin:0 0 16px 0;">Your event <strong>${escapeHtml(
        eventTitle,
      )}</strong> has been approved and is now live on Hidden Gems Boise.</p>
      ${ctaButton("View my events", url)}
    `,
  });
  const text = [
    greeting(name).replace(/<[^>]+>/g, ""),
    "",
    `Your event "${eventTitle}" has been approved and is now live:`,
    url,
  ].join("\n");
  return { subject, html, text };
}
