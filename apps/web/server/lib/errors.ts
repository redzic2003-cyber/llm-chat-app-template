import { ERROR_MESSAGES, type ApiErrorBody, type ErrorCode } from "@tm/shared-types";
import { ZodError } from "zod";

/** Statut HTTP par défaut de chaque code d'erreur. */
const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  QR_INVALID: 400,
  QR_NOT_FOUND: 404,
  QR_REVOKED: 410,
  QR_EXPIRED: 410,
  QR_WRONG_SESSION: 409,
  QR_ALREADY_ISSUED: 409,
  ATTENDANCE_ALREADY_VALIDATED: 409,
  ATTENDANCE_NOT_VALIDATED: 409,
  SESSION_CANCELLED: 409,
  SESSION_CLOSED: 409,
  PDF_SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly details?: unknown,
    status?: number,
  ) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = "ApiError";
    this.status = status ?? STATUS[code];
  }
}

export const notFound = (what = "Ressource") => new ApiError("NOT_FOUND", `${what} introuvable.`);
export const forbidden = (message?: string) => new ApiError("FORBIDDEN", message);
export const conflict = (message: string, details?: unknown) => new ApiError("CONFLICT", message, details);

interface SqliteLikeError {
  code?: string;
  message?: string;
}

function isSqliteConstraint(error: unknown): error is SqliteLikeError {
  return typeof (error as SqliteLikeError)?.code === "string" && (error as SqliteLikeError).code!.startsWith("SQLITE_CONSTRAINT");
}

/** Convertit n'importe quelle erreur en réponse uniforme `{ error: { code, message } }`. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ZodError) {
    return new ApiError(
      "VALIDATION_ERROR",
      error.issues[0]?.message ?? ERROR_MESSAGES.VALIDATION_ERROR,
      error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  if (isSqliteConstraint(error)) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE" || error.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
      return new ApiError("CONFLICT", "Cette valeur existe déjà.");
    }
    if (error.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
      return new ApiError("CONFLICT", "Élément lié introuvable ou encore utilisé.");
    }
    return new ApiError("VALIDATION_ERROR", "Contrainte de données non respectée.");
  }
  // Erreurs h3 (JSON invalide, méthode non autorisée…)
  const h3 = error as { statusCode?: number; statusMessage?: string };
  if (typeof h3?.statusCode === "number" && h3.statusCode < 500) {
    const code: ErrorCode =
      h3.statusCode === 401 ? "UNAUTHORIZED" : h3.statusCode === 403 ? "FORBIDDEN" : h3.statusCode === 404 ? "NOT_FOUND" : "VALIDATION_ERROR";
    return new ApiError(code, h3.statusMessage || ERROR_MESSAGES[code], undefined, h3.statusCode);
  }
  return new ApiError("INTERNAL_ERROR");
}

export function errorBody(error: ApiError): ApiErrorBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    },
  };
}
