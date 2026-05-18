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
