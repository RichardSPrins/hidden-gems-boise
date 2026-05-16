/// <reference path="../.astro/types.d.ts" />
declare namespace App {
  interface Locals {
    user:
      | (import("better-auth").User & {
          role?: string;
        })
      | null;
    session: import("better-auth").Session | null;
  }
}
interface ImportMetaEnv {
  readonly DATABASE_URL: string;
  readonly BETTER_AUTH_SECRET: string;
  readonly BETTER_AUTH_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
