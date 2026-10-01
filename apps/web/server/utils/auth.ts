import type { H3Event } from "h3";
import { ApiError } from "../lib/errors";
import { authenticate, type AuthenticatedSession } from "../services/auth";
import type { ServiceContext } from "../services/context";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function sessionCookieName(): string {
  // Préfixe __Host- : cookie lié à l'hôte, Secure, Path=/ (impossible à poser depuis un sous-domaine).
  return useRuntimeConfig().cookieSecure ? "__Host-tm_session" : "tm_session";
}

export function setSessionCookie(event: H3Event, token: string, expiresAt: string): void {
  const config = useRuntimeConfig();
  setCookie(event, sessionCookieName(), token, {
    httpOnly: true,
    secure: Boolean(config.cookieSecure),
    sameSite: "strict",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, sessionCookieName(), { path: "/", secure: Boolean(useRuntimeConfig().cookieSecure), sameSite: "strict" });
}

function bearerToken(event: H3Event): string | null {
  const header = getHeader(event, "authorization");
  if (!header) return null;
  const match = /^Bearer\s+([A-Za-z0-9_-]{20,200})$/.exec(header.trim());
  return match ? match[1]! : null;
}

export function presentedToken(event: H3Event): { token: string; via: "cookie" | "bearer" } | null {
  const bearer = bearerToken(event);
  if (bearer) return { token: bearer, via: "bearer" };
  const cookie = getCookie(event, sessionCookieName());
  return cookie ? { token: cookie, via: "cookie" } : null;
}

/**
 * Protection CSRF des requêtes authentifiées par cookie : l'origine doit être la nôtre.
 * (SameSite=Strict protège déjà ; ceci couvre les navigateurs anciens et les sous-domaines.)
 */
function assertSameOrigin(event: H3Event): void {
  const site = getHeader(event, "sec-fetch-site");
  if (site === "same-origin" || site === "none") return;
  const origin = getHeader(event, "origin");
  const host = getRequestHost(event, { xForwardedHost: Boolean(useRuntimeConfig().trustProxy) });
  if (origin) {
    try {
      if (new URL(origin).host === host) return;
    } catch {
      // origine illisible → refus
    }
  }
  throw new ApiError("FORBIDDEN", "Requête d'origine non autorisée.");
}

export function getAuth(event: H3Event): AuthenticatedSession | null {
  if (event.context.auth !== undefined) return event.context.auth as AuthenticatedSession | null;
  const presented = presentedToken(event);
  const auth = presented ? authenticate(useDb(), useServiceConfig(), presented.token) : null;
  if (auth && presented?.via === "cookie" && !SAFE_METHODS.has(event.method)) assertSameOrigin(event);
  event.context.auth = auth;
  event.context.userId = auth?.user.id;
  return auth;
}

export function requireAuth(event: H3Event): AuthenticatedSession {
  const auth = getAuth(event);
  if (!auth) throw new ApiError("UNAUTHORIZED");
  return auth;
}

/** Contexte de service pour l'utilisateur authentifié. */
export function useServiceContext(event: H3Event): ServiceContext {
  const auth = requireAuth(event);
  return { db: useDb(), actor: auth.actor, config: useServiceConfig() };
}

export function clientIp(event: H3Event): string {
  return getRequestIP(event, { xForwardedFor: Boolean(useRuntimeConfig().trustProxy) }) ?? "unknown";
}
