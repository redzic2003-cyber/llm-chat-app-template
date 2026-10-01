/**
 * Logs structurés JSON (une ligne par événement) sur stdout/stderr, collectés par journald.
 * Ne jamais y écrire : mot de passe, cookie, jeton Bearer, token QR brut, corps de requête.
 */
type Level = "debug" | "info" | "warn" | "error";

export function log(level: Level, event: string, data: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...data });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}
