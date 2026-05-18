import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { db } from "./db";
import { sendEmail } from "./resend";
import { passwordResetEmail, verifyEmailEmail } from "./email/templates";

export const auth = betterAuth({
  experimental: { joins: true },
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
    // requireEmailVerification: false (default). Flip to true once your
    // admin account's email_verified column is true in the DB, otherwise you
    // lock yourself out. Either click the verify link you'll receive on next
    // sign-up, or run:
    //   UPDATE "user" SET email_verified = true WHERE email = '<you>';
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
