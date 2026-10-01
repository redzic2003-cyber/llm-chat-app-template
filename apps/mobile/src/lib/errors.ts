import { ApiClientError } from "@tm/api-client";

/** Titres d'erreur explicites, affichés en grand après un scan. */
const TITLES: Record<string, string> = {
  QR_INVALID: "QR NON RECONNU",
  QR_NOT_FOUND: "QR INCONNU",
  QR_REVOKED: "QR RÉVOQUÉ",
  QR_EXPIRED: "QR EXPIRÉ",
  QR_WRONG_SESSION: "MAUVAISE SESSION",
  ATTENDANCE_ALREADY_VALIDATED: "DÉJÀ VALIDÉ",
  SESSION_CANCELLED: "SESSION ANNULÉE",
  SESSION_CLOSED: "SESSION CLÔTURÉE",
  FORBIDDEN: "NON AUTORISÉ",
  RATE_LIMITED: "TROP DE SCANS",
  UNAUTHORIZED: "SESSION EXPIRÉE",
};

export function errorTitle(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 0) return "HORS LIGNE";
    return TITLES[error.code] ?? "ERREUR";
  }
  return "ERREUR";
}

export function errorText(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur inattendue est survenue.";
}
