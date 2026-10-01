/**
 * Format des QR de présence.
 *
 * Le QR contient uniquement `TRN1:<token>` :
 * - `TRN1` est la version du format ;
 * - `<token>` est un secret aléatoire de 32 octets (256 bits) encodé en Base64URL sans padding.
 *
 * Aucune donnée personnelle, aucune URL et aucun identifiant prévisible n'y figure.
 * Ce module est isomorphe (navigateur, Capacitor, Node) ; la génération et le hachage
 * côté serveur sont dans `@tm/qr-core/node`.
 */

export const QR_VERSION = "TRN1";
export const QR_PREFIX = `${QR_VERSION}:`;
export const TOKEN_BYTES = 32;
/** 32 octets en Base64URL sans padding = 43 caractères. */
export const TOKEN_LENGTH = 43;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type ParsedPayload =
  | { ok: true; version: typeof QR_VERSION; token: string }
  | { ok: false; reason: "empty" | "prefix" | "format" };

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isWellFormedToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export function formatPayload(token: string): string {
  if (!isWellFormedToken(token)) throw new Error("Token QR mal formé");
  return QR_PREFIX + token;
}

/**
 * Extrait le token d'un contenu scanné. Tolère les espaces et retours à la ligne
 * qu'ajoutent certains lecteurs, mais rien d'autre : préfixe exact, longueur exacte.
 */
export function parsePayload(raw: string): ParsedPayload {
  const value = raw.trim();
  if (value.length === 0) return { ok: false, reason: "empty" };
  if (!value.startsWith(QR_PREFIX)) return { ok: false, reason: "prefix" };
  const token = value.slice(QR_PREFIX.length);
  if (!isWellFormedToken(token)) return { ok: false, reason: "format" };
  return { ok: true, version: QR_VERSION, token };
}

/** Génère un token avec le CSPRNG de la plateforme (Web Crypto). */
export function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** SHA-256 hexadécimal du token (Web Crypto, asynchrone). */
export async function hashTokenAsync(token: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
