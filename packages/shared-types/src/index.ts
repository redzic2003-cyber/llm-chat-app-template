/**
 * Types et constantes partagés entre l'API, le web, le mobile et le service PDF.
 *
 * Conventions :
 * - tous les horodatages sont des chaînes ISO 8601 en UTC (`2026-10-15T06:00:00.000Z`) ;
 * - les dates "calendaires" (périodes de stats/rapports) sont au format `YYYY-MM-DD`
 *   et s'interprètent dans le fuseau d'affichage configuré.
 */

// ---------------------------------------------------------------------------
// Énumérations métier
// ---------------------------------------------------------------------------

export const ROLES = ["admin", "trainer", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const SESSION_STATUSES = ["draft", "planned", "in_progress", "completed", "cancelled"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const ENROLLMENT_STATUSES = ["invited", "expected", "present", "absent", "excused"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

/** Statuts qu'un humain peut fixer directement ; `present` passe toujours par une validation. */
export const MANUAL_ENROLLMENT_STATUSES = ["invited", "expected", "absent", "excused"] as const;
export type ManualEnrollmentStatus = (typeof MANUAL_ENROLLMENT_STATUSES)[number];

export const VALIDATION_METHODS = ["qr", "manual", "offline_sync"] as const;
export type ValidationMethod = (typeof VALIDATION_METHODS)[number];

export const PERIOD_REPORT_TYPES = ["weekly", "monthly", "yearly", "custom"] as const;
export type PeriodReportType = (typeof PERIOD_REPORT_TYPES)[number];

export const REPORT_TYPES = [...PERIOD_REPORT_TYPES, "session", "participant"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const AUDIT_ACTIONS = [
  "USER_LOGIN",
  "USER_LOGIN_FAILED",
  "USER_LOGOUT",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_ROLE_CHANGED",
  "USER_DISABLED",
  "USER_PASSWORD_CHANGED",
  "TRAINING_CREATED",
  "TRAINING_UPDATED",
  "TRAINING_DEACTIVATED",
  "PARTICIPANT_CREATED",
  "PARTICIPANT_UPDATED",
  "PARTICIPANT_DEACTIVATED",
  "PARTICIPANTS_IMPORTED",
  "SESSION_CREATED",
  "SESSION_UPDATED",
  "SESSION_COMPLETED",
  "SESSION_CANCELLED",
  "PARTICIPANT_ADDED",
  "PARTICIPANT_REMOVED",
  "ENROLLMENT_STATUS_CHANGED",
  "QR_GENERATED",
  "QR_REGENERATED",
  "QR_SCANNED",
  "ATTENDANCE_VALIDATED",
  "ATTENDANCE_CANCELLED",
  "REPORT_GENERATED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// ---------------------------------------------------------------------------
// Erreurs
// ---------------------------------------------------------------------------

export const ERROR_CODES = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "CONFLICT",
  "RATE_LIMITED",
  "QR_INVALID",
  "QR_NOT_FOUND",
  "QR_REVOKED",
  "QR_EXPIRED",
  "QR_WRONG_SESSION",
  "QR_ALREADY_ISSUED",
  "ATTENDANCE_ALREADY_VALIDATED",
  "ATTENDANCE_NOT_VALIDATED",
  "SESSION_CANCELLED",
  "SESSION_CLOSED",
  "PDF_SERVICE_UNAVAILABLE",
  "INTERNAL_ERROR",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Messages par défaut (français) affichés aux utilisateurs. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: "Authentification requise.",
  FORBIDDEN: "Action non autorisée pour ce compte.",
  NOT_FOUND: "Ressource introuvable.",
  VALIDATION_ERROR: "Données invalides.",
  CONFLICT: "Conflit avec l'état actuel des données.",
  RATE_LIMITED: "Trop de tentatives. Réessayez dans quelques instants.",
  QR_INVALID: "Ce QR n'est pas un QR de présence valide.",
  QR_NOT_FOUND: "QR inconnu.",
  QR_REVOKED: "Ce QR n'est plus valide.",
  QR_EXPIRED: "Ce QR a expiré.",
  QR_WRONG_SESSION: "Ce QR appartient à une autre session.",
  QR_ALREADY_ISSUED: "Un QR actif existe déjà pour cette inscription. Utilisez la régénération.",
  ATTENDANCE_ALREADY_VALIDATED: "Présence déjà validée.",
  ATTENDANCE_NOT_VALIDATED: "Aucune présence active à annuler.",
  SESSION_CANCELLED: "Cette session est annulée.",
  SESSION_CLOSED: "Cette session est clôturée.",
  PDF_SERVICE_UNAVAILABLE: "Le service PDF est indisponible.",
  INTERNAL_ERROR: "Erreur interne.",
};

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    /** Détails structurés optionnels (erreurs de validation, présence existante…). */
    details?: unknown;
  };
}

// ---------------------------------------------------------------------------
// Références légères
// ---------------------------------------------------------------------------

export interface UserRef {
  id: string;
  displayName: string;
}

export interface TrainingRef {
  id: string;
  reference: string;
  title: string;
}

export interface ParticipantRef {
  id: string;
  employeeRef: string | null;
  firstName: string;
  lastName: string;
  department: string | null;
}

// ---------------------------------------------------------------------------
// Auth & utilisateurs
// ---------------------------------------------------------------------------

export interface UserDTO {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: string;
  disabledAt: string | null;
}

export interface AuthSessionDTO {
  user: UserDTO;
  expiresAt: string;
}

export interface LoginResponse extends AuthSessionDTO {
  /** Présent uniquement pour `client: "mobile"` (authentification Bearer). */
  token?: string;
}

// ---------------------------------------------------------------------------
// Formations, participants, sessions
// ---------------------------------------------------------------------------

export interface TrainingDTO {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  defaultDurationMinutes: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantDTO extends ParticipantRef {
  email: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantHistoryEntry {
  enrollmentId: string;
  sessionId: string;
  training: TrainingRef;
  startsAt: string;
  endsAt: string;
  sessionStatus: SessionStatus;
  status: EnrollmentStatus;
  validatedAt: string | null;
}

export interface ParticipantDetailDTO extends ParticipantDTO {
  history: ParticipantHistoryEntry[];
  totals: {
    sessionsAttended: number;
    hoursAttended: number;
  };
}

export interface ParticipantImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { line: number; message: string }[];
}

export interface EnrollmentCounts {
  enrolled: number;
  present: number;
  absent: number;
  excused: number;
  /** Inscrits non encore validés (`invited` ou `expected`). */
  pending: number;
}

export interface SessionDTO {
  id: string;
  training: TrainingRef;
  trainer: UserRef;
  startsAt: string;
  endsAt: string;
  location: string | null;
  status: SessionStatus;
  notes: string | null;
  counts: EnrollmentCounts;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentDTO {
  id: string;
  sessionId: string;
  participant: ParticipantRef;
  status: EnrollmentStatus;
  createdAt: string;
  qr: {
    active: boolean;
    issuedAt: string | null;
    expiresAt: string | null;
    lastScannedAt: string | null;
    scanCount: number;
  };
  validation: {
    id: string;
    validatedAt: string;
    validatedBy: UserRef;
    method: ValidationMethod;
  } | null;
}

export interface IssuedQrDTO {
  enrollmentId: string;
  /** Contenu exact à encoder dans le QR (`TRN1:<token>`). Affiché une seule fois. */
  payload: string;
  issuedAt: string;
  expiresAt: string | null;
  participant: ParticipantRef;
}

// ---------------------------------------------------------------------------
// Scan & présence
// ---------------------------------------------------------------------------

export type ScanTiming = "early" | "on_time" | "late";

export interface ScanResolveResponse {
  status: "ok";
  enrollmentId: string;
  participant: ParticipantRef;
  session: {
    id: string;
    title: string;
    reference: string;
    startsAt: string;
    endsAt: string;
    location: string | null;
    status: SessionStatus;
  };
  attendance:
    | { status: "pending" }
    | { status: "validated"; validatedAt: string; validatedBy: UserRef };
  /** Position de l'heure du scan par rapport au créneau de la session. */
  timing: ScanTiming;
}

export interface AttendanceValidateResponse {
  status: "validated";
  enrollmentId: string;
  validationId: string;
  validatedAt: string;
  validatedBy: UserRef;
  participant: ParticipantRef;
  /** `true` si la même clé d'idempotence avait déjà été traitée. */
  replayed: boolean;
}

export interface AttendanceRevokeResponse {
  status: "revoked";
  enrollmentId: string;
  revokedAt: string;
}

// ---------------------------------------------------------------------------
// Statistiques
// ---------------------------------------------------------------------------

export interface Period {
  /** Inclus, `YYYY-MM-DD`. */
  from: string;
  /** Inclus, `YYYY-MM-DD`. */
  to: string;
}

export interface StatsSummary {
  sessions: number;
  participations: number;
  uniqueParticipants: number;
  trainingHours: number;
  participantHours: number;
  /** Pourcentage arrondi à 0,1 ; `null` si aucun participant attendu. */
  attendanceRate: number | null;
  expected: number;
  absences: number;
  excused: number;
  averageSessionMinutes: number | null;
}

export interface SeriesPoint {
  /** `YYYY-MM-DD`, `YYYY-Www` ou `YYYY-MM` selon la granularité. */
  key: string;
  sessions: number;
  participants: number;
  participantHours: number;
}

export interface TrainingBreakdownRow {
  trainingId: string;
  reference: string;
  title: string;
  sessions: number;
  participants: number;
  participantHours: number;
}

export interface DepartmentBreakdownRow {
  department: string;
  participants: number;
  uniqueParticipants: number;
}

export interface DashboardStats {
  period: Period;
  timezone: string;
  summary: StatsSummary;
  byDay: SeriesPoint[];
  byWeek: SeriesPoint[];
  byMonth: SeriesPoint[];
  byTraining: TrainingBreakdownRow[];
  byDepartment: DepartmentBreakdownRow[];
}

// ---------------------------------------------------------------------------
// Rapports
// ---------------------------------------------------------------------------

export interface ReportDTO {
  id: string;
  type: ReportType;
  title: string;
  periodStart: string;
  periodEnd: string;
  sha256: string;
  sizeBytes: number;
  generatedBy: UserRef;
  createdAt: string;
}

export interface ReportSessionLine {
  date: string;
  start: string;
  end: string;
  reference: string;
  title: string;
  trainer: string;
  location: string | null;
  status: SessionStatus;
  present: number;
  expected: number;
}

/**
 * Contrat JSON envoyé au service PDF (`POST /render`).
 * Compatible avec `docs/blueprint/sample-report.json` : les champs au-delà de
 * `reportType`, `period`, `summary`, `trainingBreakdown`, `dailySeries` sont optionnels.
 */
export interface ReportPayload {
  reportType: ReportType;
  title?: string;
  period: Period & { label: string };
  meta?: {
    generatedAt: string;
    /** Date/heure de génération formatée dans le fuseau d'affichage (`01.10.2026 07:19`). */
    generatedAtLabel?: string;
    generatedBy: string;
    appVersion: string;
    timezone: string;
    organization?: string;
  };
  summary: Partial<StatsSummary> & {
    sessions: number;
    participations: number;
    uniqueParticipants: number;
    trainingHours: number;
    participantHours: number;
    attendanceRate: number | null;
  };
  trainingBreakdown: { reference: string; title: string; participants: number; sessions?: number; participantHours?: number }[];
  dailySeries: { date: string; participants: number }[];
  weeklySeries?: { week: string; participants: number }[];
  monthlySeries?: { month: string; participants: number }[];
  departmentBreakdown?: DepartmentBreakdownRow[];
  sessions?: ReportSessionLine[];
  session?: {
    reference: string;
    title: string;
    date: string;
    start: string;
    end: string;
    trainer: string;
    location: string | null;
    status: SessionStatus;
    participants: {
      lastName: string;
      firstName: string;
      employeeRef: string | null;
      department: string | null;
      status: EnrollmentStatus;
      validatedAt: string | null;
    }[];
  };
  participant?: {
    lastName: string;
    firstName: string;
    employeeRef: string | null;
    department: string | null;
    totalHours: number;
    trainings: {
      date: string;
      reference: string;
      title: string;
      durationHours: number;
      status: EnrollmentStatus;
    }[];
  };
}

// ---------------------------------------------------------------------------
// Audit & santé
// ---------------------------------------------------------------------------

export interface AuditLogDTO {
  id: string;
  actor: UserRef | null;
  action: string;
  entityType: string;
  entityId: string | null;
  timestamp: string;
  metadata: Record<string, unknown> | null;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  database: "ok" | "error";
  pdfService: "ok" | "unavailable";
  version: string;
}

export interface ListResponse<T> {
  items: T[];
}
