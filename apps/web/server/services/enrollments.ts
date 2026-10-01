import { localDateKey, localTime } from "@tm/analytics";
import type { EnrollmentDTO, ManualEnrollmentStatus } from "@tm/shared-types";
import {
  attendanceValidations,
  enrollments,
  newId,
  participants,
  qrTokens,
  users,
  type DbExecutor,
} from "@tm/database";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { toCsv } from "../lib/csv";
import { ApiError, notFound } from "../lib/errors";
import { assertCan, assertCanManageSession } from "../lib/permissions";
import { writeAudit } from "./audit";
import { currentTime, type ServiceContext } from "./context";
import { toParticipantRef } from "./mappers";
import { assertSessionOpen, loadSession } from "./sessions";

const STATUS_LABELS: Record<string, string> = {
  invited: "Invité",
  expected: "À valider",
  present: "Présent",
  absent: "Absent",
  excused: "Excusé",
};

/** Inscriptions d'une session avec l'état du QR et la validation active. */
export function enrollmentsForSession(db: DbExecutor, sessionId: string, onlyIds?: string[]): EnrollmentDTO[] {
  const conditions = [eq(enrollments.sessionId, sessionId)];
  if (onlyIds) conditions.push(inArray(enrollments.id, onlyIds.length ? onlyIds : ["-"]));
  const rows = db
    .select({ enrollment: enrollments, participant: participants })
    .from(enrollments)
    .innerJoin(participants, eq(participants.id, enrollments.participantId))
    .where(and(...conditions))
    .orderBy(asc(participants.lastName), asc(participants.firstName))
    .all();
  const ids = rows.map((r) => r.enrollment.id);
  if (ids.length === 0) return [];

  const tokens = db
    .select({
      enrollmentId: qrTokens.enrollmentId,
      activeCreatedAt: sql<string | null>`max(case when ${qrTokens.revokedAt} is null then ${qrTokens.createdAt} end)`,
      activeExpiresAt: sql<string | null>`max(case when ${qrTokens.revokedAt} is null then ${qrTokens.expiresAt} end)`,
      lastScannedAt: sql<string | null>`max(${qrTokens.lastScannedAt})`,
      scanCount: sql<number>`coalesce(sum(${qrTokens.scanCount}), 0)`,
    })
    .from(qrTokens)
    .where(inArray(qrTokens.enrollmentId, ids))
    .groupBy(qrTokens.enrollmentId)
    .all();
  const tokenMap = new Map(tokens.map((t) => [t.enrollmentId, t]));

  const validations = db
    .select({ validation: attendanceValidations, validator: { id: users.id, displayName: users.displayName } })
    .from(attendanceValidations)
    .innerJoin(users, eq(users.id, attendanceValidations.validatedBy))
    .where(and(inArray(attendanceValidations.enrollmentId, ids), isNull(attendanceValidations.revokedAt)))
    .all();
  const validationMap = new Map(validations.map((v) => [v.validation.enrollmentId, v]));

  return rows.map(({ enrollment, participant }) => {
    const token = tokenMap.get(enrollment.id);
    const v = validationMap.get(enrollment.id);
    return {
      id: enrollment.id,
      sessionId: enrollment.sessionId,
      participant: toParticipantRef(participant),
      status: enrollment.status,
      createdAt: enrollment.createdAt,
      qr: {
        active: Boolean(token?.activeCreatedAt),
        issuedAt: token?.activeCreatedAt ?? null,
        expiresAt: token?.activeExpiresAt ?? null,
        lastScannedAt: token?.lastScannedAt ?? null,
        scanCount: Number(token?.scanCount ?? 0),
      },
      validation: v
        ? {
            id: v.validation.id,
            validatedAt: v.validation.validatedAt,
            validatedBy: v.validator,
            method: v.validation.method,
          }
        : null,
    };
  });
}

export function listEnrollments(ctx: ServiceContext, sessionId: string): EnrollmentDTO[] {
  assertCan(ctx.actor, "read");
  loadSession(ctx.db, sessionId);
  return enrollmentsForSession(ctx.db, sessionId);
}

export function addEnrollments(ctx: ServiceContext, sessionId: string, participantIds: string[]): EnrollmentDTO[] {
  const { session } = loadSession(ctx.db, sessionId);
  assertCanManageSession(ctx.actor, session);
  assertSessionOpen(session);

  const unique = [...new Set(participantIds)];
  const found = ctx.db.select().from(participants).where(inArray(participants.id, unique)).all();
  if (found.length !== unique.length) throw notFound("Participant");
  const inactive = found.filter((p) => !p.active);
  if (inactive.length) {
    throw new ApiError("VALIDATION_ERROR", "Impossible d'inscrire un participant désactivé.", inactive.map((p) => ({ id: p.id })));
  }

  const already = new Set(
    ctx.db
      .select({ participantId: enrollments.participantId })
      .from(enrollments)
      .where(and(eq(enrollments.sessionId, sessionId), inArray(enrollments.participantId, unique)))
      .all()
      .map((r) => r.participantId),
  );
  const now = currentTime(ctx).toISOString();
  const created: string[] = [];
  ctx.db.transaction((tx) => {
    for (const participantId of unique) {
      if (already.has(participantId)) continue;
      const id = newId();
      tx.insert(enrollments).values({ id, sessionId, participantId, status: "expected", createdAt: now, updatedAt: now }).run();
      created.push(id);
      writeAudit(tx, { actorId: ctx.actor.id, action: "PARTICIPANT_ADDED", entityType: "enrollment", entityId: id, metadata: { sessionId, participantId }, at: now });
    }
  });
  return enrollmentsForSession(ctx.db, sessionId, created);
}

function loadEnrollment(ctx: ServiceContext, sessionId: string, enrollmentId: string) {
  const enrollment = ctx.db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.sessionId, sessionId)))
    .get();
  if (!enrollment) throw notFound("Inscription");
  return enrollment;
}

export function removeEnrollment(ctx: ServiceContext, sessionId: string, enrollmentId: string): void {
  const { session } = loadSession(ctx.db, sessionId);
  assertCanManageSession(ctx.actor, session);
  assertSessionOpen(session);
  const enrollment = loadEnrollment(ctx, sessionId, enrollmentId);
  if (enrollment.status === "present") {
    throw new ApiError("ATTENDANCE_ALREADY_VALIDATED", "Annulez d'abord la présence validée avant de retirer ce participant.");
  }
  const now = currentTime(ctx).toISOString();
  ctx.db.transaction((tx) => {
    tx.delete(enrollments).where(eq(enrollments.id, enrollmentId)).run();
    writeAudit(tx, {
      actorId: ctx.actor.id,
      action: "PARTICIPANT_REMOVED",
      entityType: "enrollment",
      entityId: enrollmentId,
      metadata: { sessionId, participantId: enrollment.participantId },
      at: now,
    });
  });
}

/** Statut manuel (excusé, absent, invité, attendu). « Présent » passe par une validation. */
export function setEnrollmentStatus(
  ctx: ServiceContext,
  sessionId: string,
  enrollmentId: string,
  status: ManualEnrollmentStatus,
): EnrollmentDTO {
  const { session } = loadSession(ctx.db, sessionId);
  assertCanManageSession(ctx.actor, session);
  if (session.status === "cancelled") throw new ApiError("SESSION_CANCELLED");
  const enrollment = loadEnrollment(ctx, sessionId, enrollmentId);
  if (enrollment.status === "present") {
    throw new ApiError("ATTENDANCE_ALREADY_VALIDATED", "Annulez d'abord la présence validée.");
  }
  // Après clôture, seule la qualification d'une absence (absent ↔ excusé) reste possible.
  if (session.status === "completed" && !(status === "absent" || status === "excused")) {
    throw new ApiError("SESSION_CLOSED");
  }
  const now = currentTime(ctx).toISOString();
  ctx.db.transaction((tx) => {
    tx.update(enrollments).set({ status, updatedAt: now }).where(eq(enrollments.id, enrollmentId)).run();
    writeAudit(tx, {
      actorId: ctx.actor.id,
      action: "ENROLLMENT_STATUS_CHANGED",
      entityType: "enrollment",
      entityId: enrollmentId,
      metadata: { from: enrollment.status, to: status },
      at: now,
    });
  });
  return enrollmentsForSession(ctx.db, sessionId, [enrollmentId])[0]!;
}

/** Liste d'émargement exportable (CSV `;`, UTF-8 avec BOM). */
export function exportSessionCsv(ctx: ServiceContext, sessionId: string): { filename: string; content: string } {
  assertCan(ctx.actor, "read");
  const { session, training } = loadSession(ctx.db, sessionId);
  const tz = ctx.config.timezone;
  const rows = enrollmentsForSession(ctx.db, sessionId).map((e) => [
    e.participant.lastName,
    e.participant.firstName,
    e.participant.employeeRef,
    e.participant.department,
    STATUS_LABELS[e.status] ?? e.status,
    e.validation ? `${localDateKey(e.validation.validatedAt, tz)} ${localTime(e.validation.validatedAt, tz)}` : "",
    e.validation?.validatedBy.displayName ?? "",
    e.validation?.method ?? "",
  ]);
  const content = toCsv(["Nom", "Prénom", "Matricule", "Département", "Statut", "Validé le", "Validé par", "Méthode"], rows);
  const date = localDateKey(session.startsAt, tz);
  return { filename: `presences-${training.reference}-${date}.csv`.replace(/[^A-Za-z0-9._-]/g, "_"), content };
}
