/**
 * Génération et hachage des tokens QR côté serveur (Node).
 *
 * Le serveur ne conserve que `SHA-256(token)` ; le token brut n'existe qu'au moment
 * de l'émission, le temps d'être encodé dans le QR imprimé.
 */
import { createHash, randomBytes } from "node:crypto";
import { TOKEN_BYTES, formatPayload, parsePayload, type ParsedPayload } from "./index";

export * from "./index";

export function generateTokenNode(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export interface IssuedToken {
  /** Contenu à encoder dans le QR. Ne jamais le journaliser ni le stocker. */
  payload: string;
  /** Empreinte à stocker en base. */
  hash: string;
}

export function issueToken(): IssuedToken {
  const token = generateTokenNode();
  return { payload: formatPayload(token), hash: hashToken(token) };
}

/** Parse un contenu scanné et renvoie directement l'empreinte à rechercher. */
export function hashPayload(raw: string): { ok: true; hash: string } | Extract<ParsedPayload, { ok: false }> {
  const parsed = parsePayload(raw);
  if (!parsed.ok) return parsed;
  return { ok: true, hash: hashToken(parsed.token) };
}
