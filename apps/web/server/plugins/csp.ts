import { createHash } from "node:crypto";

/**
 * Content-Security-Policy stricte pour les pages HTML : aucun script inline autorisé
 * sauf ceux générés par Nuxt, autorisés par leur empreinte SHA-256.
 */
export default defineNitroPlugin((nitro) => {
  if (import.meta.dev) return;
  nitro.hooks.hook("render:response", (response) => {
    if (typeof response.body !== "string" || !response.body.includes("<html")) return;
    const hashes = new Set<string>();
    const inlineScript = /<script(?![^>]*\bsrc=)(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g;
    for (const match of response.body.matchAll(inlineScript)) {
      const content = match[1] ?? "";
      if (content.trim()) hashes.add(`'sha256-${createHash("sha256").update(content).digest("base64")}'`);
    }
    response.headers = {
      ...response.headers,
      "content-security-policy": [
        "default-src 'self'",
        `script-src 'self' ${[...hashes].join(" ")}`.trim(),
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join("; "),
    };
  });
});
