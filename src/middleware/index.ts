import { auth } from "../lib/auth";
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const isAuthed = await auth.api.getSession({
    headers: context.request.headers,
  });

  if (isAuthed) {
    context.locals.user = isAuthed.user;
    context.locals.session = isAuthed.session;
  } else {
    context.locals.user = null;
    context.locals.session = null;
  }

  const path = context.url.pathname;
  const role = (context.locals.user as { role?: string } | null)?.role;

  if (path.startsWith("/admin")) {
    if (!context.locals.user) {
      return context.redirect(`/auth/login?next=${encodeURIComponent(path)}`);
    }
    if (role !== "ADMIN") {
      return context.redirect("/portal");
    }
  }

  if (path.startsWith("/portal")) {
    if (!context.locals.user) {
      return context.redirect(`/auth/login?next=${encodeURIComponent(path)}`);
    }
  }

  return next();
});
