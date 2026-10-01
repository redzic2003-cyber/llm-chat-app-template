/**
 * Schéma Drizzle — reprend docs/blueprint/schema.sql avec les ajouts nécessaires
 * à l'implémentation (signalés par « ajout »).
 *
 * Conventions : identifiants UUIDv7 en TEXT, horodatages ISO 8601 UTC en TEXT,
 * booléens en INTEGER 0/1.
 */
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ["admin", "trainer", "viewer"] }).notNull(),
    /** Ajout : hash scrypt du mot de passe (null si authentification externe). */
    passwordHash: text("password_hash"),
    authSubject: text("auth_subject").unique(),
    createdAt: text("created_at").notNull(),
    /** Ajout. */
    updatedAt: text("updated_at").notNull(),
    disabledAt: text("disabled_at"),
  },
  (t) => [check("users_role_check", sql`${t.role} IN ('admin','trainer','viewer')`)],
);

/** Ajout : sessions d'authentification (cookie web ou Bearer mobile). Seul le hash du jeton est stocké. */
export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["web", "mobile"] }).notNull(),
    deviceName: text("device_name"),
    createdAt: text("created_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (t) => [
    check("auth_sessions_kind_check", sql`${t.kind} IN ('web','mobile')`),
    index("idx_auth_sessions_user").on(t.userId),
  ],
);

export const participants = sqliteTable(
  "participants",
  {
    id: text("id").primaryKey(),
    employeeRef: text("employee_ref").unique(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    department: text("department"),
    email: text("email"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    check("participants_active_check", sql`${t.active} IN (0,1)`),
    index("idx_participants_name").on(t.lastName, t.firstName),
  ],
);

export const trainings = sqliteTable(
  "trainings",
  {
    id: text("id").primaryKey(),
    reference: text("reference").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    defaultDurationMinutes: integer("default_duration_minutes"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [check("trainings_active_check", sql`${t.active} IN (0,1)`)],
);

export const trainingSessions = sqliteTable(
  "training_sessions",
  {
    id: text("id").primaryKey(),
    trainingId: text("training_id")
      .notNull()
      .references(() => trainings.id),
    trainerId: text("trainer_id")
      .notNull()
      .references(() => users.id),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    location: text("location"),
    status: text("status", { enum: ["draft", "planned", "in_progress", "completed", "cancelled"] })
      .notNull()
      .default("draft"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    check("training_sessions_status_check", sql`${t.status} IN ('draft','planned','in_progress','completed','cancelled')`),
    check("training_sessions_time_check", sql`${t.endsAt} > ${t.startsAt}`),
    index("idx_sessions_starts_at").on(t.startsAt),
    index("idx_sessions_training").on(t.trainingId),
    index("idx_sessions_trainer").on(t.trainerId),
  ],
);

export const enrollments = sqliteTable(
  "enrollments",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id),
    status: text("status", { enum: ["invited", "expected", "present", "absent", "excused"] })
      .notNull()
      .default("expected"),
    createdAt: text("created_at").notNull(),
    /** Ajout. */
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    check("enrollments_status_check", sql`${t.status} IN ('invited','expected','present','absent','excused')`),
    uniqueIndex("enrollments_session_participant_unique").on(t.sessionId, t.participantId),
    index("idx_enrollments_session").on(t.sessionId),
    index("idx_enrollments_participant").on(t.participantId),
  ],
);

export const qrTokens = sqliteTable(
  "qr_tokens",
  {
    id: text("id").primaryKey(),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at"),
    revokedAt: text("revoked_at"),
    lastScannedAt: text("last_scanned_at"),
    scanCount: integer("scan_count").notNull().default(0),
  },
  (t) => [
    index("idx_qr_enrollment").on(t.enrollmentId),
    // Ajout : au plus un QR actif par inscription.
    uniqueIndex("qr_tokens_one_active_per_enrollment").on(t.enrollmentId).where(sql`revoked_at IS NULL`),
  ],
);

export const attendanceValidations = sqliteTable(
  "attendance_validations",
  {
    id: text("id").primaryKey(),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    validatedBy: text("validated_by")
      .notNull()
      .references(() => users.id),
    validatedAt: text("validated_at").notNull(),
    method: text("method", { enum: ["qr", "manual", "offline_sync"] })
      .notNull()
      .default("qr"),
    deviceId: text("device_id"),
    note: text("note"),
    /** Ajout : clé fournie par le client pour rendre la validation idempotente. */
    idempotencyKey: text("idempotency_key").unique(),
    /** Ajout : annulation (l'historique complet est conservé). */
    revokedAt: text("revoked_at"),
    revokedBy: text("revoked_by").references(() => users.id),
    revokeReason: text("revoke_reason"),
  },
  (t) => [
    check("attendance_method_check", sql`${t.method} IN ('qr','manual','offline_sync')`),
    index("idx_attendance_enrollment").on(t.enrollmentId),
    index("idx_attendance_validated_at").on(t.validatedAt),
    // Ajout : « une présence active maximum par enrollment », garanti par la base.
    uniqueIndex("attendance_one_active_per_enrollment").on(t.enrollmentId).where(sql`revoked_at IS NULL`),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    timestamp: text("timestamp").notNull(),
    metadataJson: text("metadata_json"),
  },
  (t) => [index("idx_audit_timestamp").on(t.timestamp), index("idx_audit_entity").on(t.entityType, t.entityId)],
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    /** Ajout : libellé affiché (« Bilan de formation — Septembre 2026 »). */
    title: text("title").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    filePath: text("file_path").notNull(),
    sha256: text("sha256").notNull(),
    /** Ajout. */
    sizeBytes: integer("size_bytes").notNull(),
    /** Ajout : paramètres de la demande (sessionId, participantId…). */
    paramsJson: text("params_json"),
    generatedBy: text("generated_by")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_reports_created_at").on(t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
export type Participant = typeof participants.$inferSelect;
export type Training = typeof trainings.$inferSelect;
export type TrainingSession = typeof trainingSessions.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type QrToken = typeof qrTokens.$inferSelect;
export type AttendanceValidation = typeof attendanceValidations.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Report = typeof reports.$inferSelect;
