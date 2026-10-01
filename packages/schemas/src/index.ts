/**
 * Schémas Zod de tous les payloads de l'API (cf. docs/blueprint/07-api-contract.md).
 * Ils sont la seule source de validation côté serveur et peuvent être réutilisés
 * côté client pour les formulaires.
 */
import {
  MANUAL_ENROLLMENT_STATUSES,
  PERIOD_REPORT_TYPES,
  ROLES,
  SESSION_STATUSES,
} from "@tm/shared-types";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Date calendaire `YYYY-MM-DD`. */
export const dateKey = z
  .string()
  .regex(DATE_KEY, "Format attendu : AAAA-MM-JJ")
  .refine(isRealDate, "Date inexistante");

/** Instant ISO 8601 avec fuseau, normalisé en UTC (`toISOString`). */
export const isoInstant = z.iso
  .datetime({ offset: true, message: "Horodatage ISO 8601 attendu" })
  .transform((v) => new Date(v).toISOString());

export const id = z.string().min(1).max(64);

const trimmed = (max: number) => z.string().trim().max(max);
const requiredText = (max: number) => trimmed(max).min(1, "Champ obligatoire");
/** Texte optionnel : chaîne vide → `null`. */
const optionalText = (max: number) =>
  trimmed(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const email = z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide")).pipe(z.string().max(254));

/** Mot de passe fort : 12 caractères minimum, 256 maximum (limite anti-DoS du hachage). */
export const password = z.string().min(12, "12 caractères minimum").max(256);

const booleanQuery = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((v) => v === true || v === "true" || v === "1");

// ---------------------------------------------------------------------------
// Auth & utilisateurs
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(256),
  /** `mobile` → renvoie un token Bearer au lieu de poser un cookie. */
  client: z.enum(["web", "mobile"]).default("web"),
  deviceName: optionalText(100),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: password,
});

export const userCreateSchema = z.object({
  email,
  displayName: requiredText(120),
  role: z.enum(ROLES),
  password,
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z
  .object({
    displayName: requiredText(120),
    role: z.enum(ROLES),
    disabled: z.boolean(),
    password,
  })
  .partial();
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const usersQuerySchema = z.object({
  role: z.enum(ROLES).optional(),
  includeDisabled: booleanQuery.optional(),
});

// ---------------------------------------------------------------------------
// Formations
// ---------------------------------------------------------------------------

export const trainingReference = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9._/-]{1,31}$/, "2 à 32 caractères : lettres, chiffres, . _ / -");

export const trainingCreateSchema = z.object({
  reference: trainingReference,
  title: requiredText(200),
  description: optionalText(2000),
  defaultDurationMinutes: z.number().int().min(5).max(1440).nullish().transform((v) => v ?? null),
  active: z.boolean().default(true),
});
export type TrainingCreateInput = z.infer<typeof trainingCreateSchema>;

export const trainingUpdateSchema = z
  .object({
    reference: trainingReference,
    title: requiredText(200),
    description: optionalText(2000),
    defaultDurationMinutes: z.number().int().min(5).max(1440).nullable(),
    active: z.boolean(),
  })
  .partial();
export type TrainingUpdateInput = z.infer<typeof trainingUpdateSchema>;

export const trainingsQuerySchema = z.object({
  includeInactive: booleanQuery.optional(),
});

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

const participantFields = {
  employeeRef: optionalText(64),
  firstName: requiredText(100),
  lastName: requiredText(100),
  department: optionalText(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .nullish()
    .transform((v) => (v ? v : null))
    .pipe(z.email("Adresse e-mail invalide").nullable()),
};

export const participantCreateSchema = z.object({
  ...participantFields,
  active: z.boolean().default(true),
});
export type ParticipantCreateInput = z.infer<typeof participantCreateSchema>;

export const participantUpdateSchema = z.object({ ...participantFields, active: z.boolean() }).partial();
export type ParticipantUpdateInput = z.infer<typeof participantUpdateSchema>;

export const participantsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  includeInactive: booleanQuery.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

/** Import CSV : le corps est le texte brut du fichier (UTF-8). */
export const participantImportSchema = z.object({
  csv: z.string().min(1).max(2_000_000),
});

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const sessionCreateSchema = z
  .object({
    trainingId: id,
    /** Par défaut : l'utilisateur courant. */
    trainerId: id.optional(),
    startsAt: isoInstant,
    endsAt: isoInstant,
    location: optionalText(200),
    status: z.enum(["draft", "planned"]).default("planned"),
    notes: optionalText(2000),
  })
  .refine((s) => s.endsAt > s.startsAt, { message: "La fin doit suivre le début", path: ["endsAt"] });
export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;

export const sessionUpdateSchema = z
  .object({
    trainingId: id,
    trainerId: id,
    startsAt: isoInstant,
    endsAt: isoInstant,
    location: optionalText(200),
    status: z.enum(["draft", "planned", "in_progress"]),
    notes: optionalText(2000),
  })
  .partial()
  .refine((s) => !(s.startsAt && s.endsAt) || s.endsAt > s.startsAt, {
    message: "La fin doit suivre le début",
    path: ["endsAt"],
  });
export type SessionUpdateInput = z.infer<typeof sessionUpdateSchema>;

export const sessionsQuerySchema = z
  .object({
    from: isoInstant.optional(),
    to: isoInstant.optional(),
    trainerId: id.optional(),
    trainingId: id.optional(),
    mine: booleanQuery.optional(),
    status: z.enum(SESSION_STATUSES).optional(),
  })
  .refine((q) => !(q.from && q.to) || q.to > q.from, { message: "Intervalle invalide", path: ["to"] });

export const sessionCancelSchema = z.object({
  reason: optionalText(500),
});

// ---------------------------------------------------------------------------
// Inscriptions & QR
// ---------------------------------------------------------------------------

export const enrollmentsAddSchema = z.object({
  participantIds: z.array(id).min(1).max(500),
});

export const enrollmentUpdateSchema = z.object({
  status: z.enum(MANUAL_ENROLLMENT_STATUSES),
});

export const qrBatchSchema = z.object({
  /** `missing` : uniquement les inscriptions sans QR actif ; `all` : régénère tout. */
  mode: z.enum(["missing", "all"]).default("missing"),
});

// ---------------------------------------------------------------------------
// Scan & présence
// ---------------------------------------------------------------------------

export const scanResolveSchema = z.object({
  payload: z.string().max(512),
  /** Session dans laquelle le formateur scanne (détection « mauvaise session »). */
  sessionId: id.optional(),
  deviceId: optionalText(100),
});
export type ScanResolveInput = z.infer<typeof scanResolveSchema>;

export const attendanceValidateSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(100),
  method: z.enum(["qr", "manual"]).default("qr"),
  deviceId: optionalText(100),
  note: optionalText(500),
});
export type AttendanceValidateInput = z.infer<typeof attendanceValidateSchema>;

export const attendanceRevokeSchema = z.object({
  reason: optionalText(500),
});

// ---------------------------------------------------------------------------
// Statistiques
// ---------------------------------------------------------------------------

export const MAX_PERIOD_DAYS = 3660;

const periodRefine = <T extends { from: string; to: string }>(p: T) =>
  p.to >= p.from &&
  (Date.parse(`${p.to}T00:00:00Z`) - Date.parse(`${p.from}T00:00:00Z`)) / 86_400_000 <= MAX_PERIOD_DAYS;

export const periodSchema = z
  .object({ from: dateKey, to: dateKey })
  .refine(periodRefine, { message: "Période invalide (fin avant début ou plus de 10 ans)", path: ["to"] });

export const statsQuerySchema = z
  .object({
    from: dateKey,
    to: dateKey,
    trainingId: id.optional(),
    trainerId: id.optional(),
    department: z.string().trim().max(100).optional(),
  })
  .refine(periodRefine, { message: "Période invalide (fin avant début ou plus de 10 ans)", path: ["to"] });
export type StatsQuery = z.infer<typeof statsQuerySchema>;

// ---------------------------------------------------------------------------
// Rapports
// ---------------------------------------------------------------------------

export const reportCreateSchema = z.discriminatedUnion("type", [
  z
    .object({ type: z.enum(PERIOD_REPORT_TYPES), from: dateKey, to: dateKey })
    .refine(periodRefine, { message: "Période invalide", path: ["to"] }),
  z.object({ type: z.literal("session"), sessionId: id }),
  z
    .object({ type: z.literal("participant"), participantId: id, from: dateKey.optional(), to: dateKey.optional() })
    .refine((p) => !(p.from && p.to) || p.to >= p.from, { message: "Période invalide", path: ["to"] }),
]);
export type ReportCreateInput = z.infer<typeof reportCreateSchema>;

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  before: z.string().max(64).optional(),
  entityType: z.string().max(64).optional(),
  entityId: z.string().max(64).optional(),
  action: z.string().max(64).optional(),
});

export { z };
