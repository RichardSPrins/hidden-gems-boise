import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { db } from "./db";
import { sendEmail } from "./resend";
import { passwordResetEmail, verifyEmailEmail } from "./email/templates";
import { appBaseUrl } from "./url";

/**
 * Origins Better Auth will accept login/auth POSTs from. Behind Railway's proxy
 * Better Auth mis-infers its own origin (it sees the internal localhost:8080),
 * so we must pin this explicitly or every cross-origin auth call is rejected as
 * "Invalid origin". We trust the configured public origin(s) plus the known
 * production domains (apex + www) and the Railway domain as a safety net.
 */
function buildTrustedOrigins(): string[] {
  const origins = new Set<string>();
  const add = (v?: string | null) => {
    const t = v?.trim().replace(/\/$/, "");
    if (t) origins.add(t);
  };
  // Explicit override wins (comma-separated list in TRUSTED_ORIGINS).
  process.env.TRUSTED_ORIGINS?.split(",").forEach(add);
  // Configured public origins.
  add(process.env.PUBLIC_APP_URL);
  add(process.env.BETTER_AUTH_URL);
  add(appBaseUrl());
  // Known production domains — apex + www, so both resolve regardless of which
  // one the browser lands on.
  add("https://hiddengemsboise.com");
  add("https://www.hiddengemsboise.com");
  // Railway-provided domain (if the app is ever hit directly there).
  origins.add("https://*.up.railway.app");
  return [...origins];
}

export const auth = betterAuth({
  experimental: { joins: true },
  baseURL: appBaseUrl(),
  trustedOrigins: buildTrustedOrigins(),
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    // Reset password is wired. Forgot-password page POSTs to
    // /api/auth/forget-password with { email, redirectTo: '/auth/reset-password' }.
    // Better Auth then calls this with a URL that validates the token and
    // redirects the user to /auth/reset-password?token=...
    sendResetPassword: async ({ user, url }) => {
      const { subject, html, text } = passwordResetEmail({
        name: user.name,
        url,
      });
      // Don't await: prevents timing attacks per Better Auth guidance, and
      // matches the runInBackgroundOrAwait Better Auth uses internally.
      void sendEmail({ to: user.email, subject, html, text, kind: "auth" });
    },
    requireEmailVerification: true,
  },
  emailVerification: {
    // Auto-send a verification email on sign-up. Login still works without
    // verification (requireEmailVerification is off above) — this gives users
    // a clean inbox prompt without blocking them at the only conversion moment.
    sendOnSignUp: true,
    // After the user clicks the link, sign them in automatically and land on
    // the callbackURL from the sign-up call (or "/" if none).
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const { subject, html, text } = verifyEmailEmail({
        name: user.name,
        url,
      });
      void sendEmail({ to: user.email, subject, html, text, kind: "auth" });
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "BUSINESS_OWNER",
        input: false,
      },
    },
  },
});
