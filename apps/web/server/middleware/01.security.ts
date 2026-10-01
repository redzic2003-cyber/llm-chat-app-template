/**
 * En-têtes de sécurité, CORS restrictif (app mobile) et limite de taille des requêtes API.
 * La Content-Security-Policy des pages HTML est posée par le plugin `csp`.
 */
const MAX_BODY_BYTES = 3 * 1024 * 1024;

export default defineEventHandler((event) => {
  const config = useRuntimeConfig();
  setHeaders(event, {
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "cross-origin-opener-policy": "same-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  });
  if (config.cookieSecure) setHeader(event, "strict-transport-security", "max-age=31536000; includeSubDomains");

  const path = event.path;
  if (!path.startsWith("/api/")) return;

  setHeader(event, "cache-control", "no-store");

  const origin = getHeader(event, "origin");
  const allowed = String(config.corsOrigins)
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (origin && allowed.includes(origin)) {
    // Pas de credentials cross-origin : le mobile s'authentifie par jeton Bearer.
    setHeaders(event, {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization, content-type, accept",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "access-control-max-age": 600,
      vary: "Origin",
    });
  }
  if (event.method === "OPTIONS") {
    setResponseStatus(event, 204);
    return "";
  }

  const length = Number(getHeader(event, "content-length") ?? 0);
  if (length > MAX_BODY_BYTES) {
    setResponseStatus(event, 413);
    return { error: { code: "VALIDATION_ERROR", message: "Requête trop volumineuse." } };
  }
});
