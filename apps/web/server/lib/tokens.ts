import { createHash, randomBytes } from "node:crypto";

/** Jeton de session opaque (256 bits) ; seul son SHA-256 est stocké. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
