/**
 * Validation et annulation de présence.
 *
 * Tout se fait dans une transaction SQLite ; l'index unique partiel
 * `attendance_one_active_per_enrollment` garantit en plus, au niveau de la base,
 * qu'une inscription n'a jamais deux présences actives.
 */
import type { AttendanceValidateInput } from "@tm/schemas";
import type { AttendanceRevokeResponse, AttendanceValidateResponse } from "@tm/shared-types";
import {
  attendanceValidations,
  enrollments,
  newId,
  participants,
  trainingSessions,
  users,
} from "@tm/database";
import { and, eq, isNull } from "drizzle-orm";
import { ApiError, notFound } from "../lib/errors";
import { assertCanManageSession } from "../lib/permissions";
import { writeAudit } from "./audit";
import { currentTime, type ServiceContext } from "./context";
import { toParticipantRef } from "./mappers";

function loadForAttendance(ctx: ServiceContext, enrollmentId: string) {
  const row = ctx.db
    .select({ enrollment: enrollments, participant: participants, session: trainingSessions })
    .from(enrollments)
    .innerJoin(participants, eq(participants.id, enrollments.participantId))
    .innerJoin(trainingSessions, eq(trainingSessions.id, enrollments.sessionId))
    .where(eq(enrollments.id, enrollmentId))
    .get();
  if (!row) throw notFound("Inscription");
  assertCanManageSession(ctx.actor, row.session);
  return row;
}

function activeValidation(ctx: ServiceContext, enrollmentId: string) {
  return ctx.db
    .select({ validation: attendanceValidations, validator: { id: users.id, displayName: users.displayName } })
    .from(attendanceValidations)
    .innerJoin(users, eq(users.id, attendanceValidations.validatedBy))
    .where(and(eq(attendanceValidations.enrollmentId, enrollmentId), isNull(attendanceValidations.revokedAt)))
    .get();
}

function alreadyValidated(existing: NonNullable<ReturnType<typeof activeValidation>>) {
  return new ApiError("ATTENDANCE_ALREADY_VALIDATED", undefined, {
    validatedAt: existing.validation.validatedAt,
    validatedBy: existing.validator,
  });
}

export function validateAttendance(
  ctx: ServiceContext,
  enrollmentId: string,
  input: AttendanceValidateInput,
): AttendanceValidateResponse {
  const { enrollment, participant, session } = loadForAttendance(ctx, enrollmentId);

  // Idempotence : un renvoi de la même requête (réseau instable) renvoie le même résultat.
  const prior = ctx.db
    .select({ validation: attendanceValidations, validator: { id: users.id, displayName: users.displayName } })
    .from(attendanceValidations)
    .innerJoin(users, eq(users.id, attendanceValidations.validatedBy))
    .where(eq(attendanceValidations.idempotencyKey, input.idempotencyKey))
    .get();
  if (prior) {
    if (prior.validation.enrollmentId !== enrollmentId || prior.validation.revokedAt) {
      throw new ApiError("CONFLICT", "Clé d'idempotence déjà utilisée pour une autre opération.");
    }
    return {
      status: "validated",
      enrollmentId,
      validationId: prior.validation.id,
      validatedAt: prior.validation.validatedAt,
      validatedBy: prior.validator,
      participant: toParticipantRef(participant),
      replayed: true,
    };
  }

  if (session.status === "cancelled") throw new ApiError("SESSION_CANCELLED");
  // Correction après clôture : réservée aux administrateurs, en saisie manuelle.
  if (session.status === "completed" && !(ctx.actor.role === "admin" && input.method === "manual")) {
    throw new ApiError("SESSION_CLOSED");
  }

  const existing = activeValidation(ctx, enrollmentId);
  if (existing) throw alreadyValidated(existing);

  const now = currentTime(ctx);
  const nowIso = now.toISOString();
  const validationId = newId();
  try {
    ctx.db.transaction((tx) => {
      tx.insert(attendanceValidations)
        .values({
          id: validationId,
          enrollmentId,
          validatedBy: ctx.actor.id,
          validatedAt: nowIso,
          method: input.method,
          deviceId: input.deviceId,
          note: input.note,
          idempotencyKey: input.idempotencyKey,
        })
        .run();
      tx.update(enrollments).set({ status: "present", updatedAt: nowIso }).where(eq(enrollments.id, enrollmentId)).run();
      // Première présence sur une session planifiée et commencée : elle passe « en cours ».
      if (session.status === "planned" && Date.parse(session.startsAt) <= now.getTime() + 30 * 60_000) {
        tx.update(trainingSessions).set({ status: "in_progress", updatedAt: nowIso }).where(eq(trainingSessions.id, session.id)).run();
      }
      writeAudit(tx, {
        actorId: ctx.actor.id,
        action: "ATTENDANCE_VALIDATED",
        entityType: "enrollment",
        entityId: enrollmentId,
        metadata: { sessionId: session.id, method: input.method, deviceId: input.deviceId, previousStatus: enrollment.status },
        at: nowIso,
      });
    });
  } catch (error) {
    // Course entre deux appareils : l'index unique partiel a tranché.
    if ((error as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
      const winner = activeValidation(ctx, enrollmentId);
      if (winner) throw alreadyValidated(winner);
    }
    throw error;
  }

  return {
    status: "validated",
    enrollmentId,
    validationId,
    validatedAt: nowIso,
    validatedBy: { id: ctx.actor.id, displayName: ctx.actor.displayName },
    participant: toParticipantRef(participant),
    replayed: false,
  };
}

export function revokeAttendance(ctx: ServiceContext, enrollmentId: string, reason: string | null): AttendanceRevokeResponse {
  const { session } = loadForAttendance(ctx, enrollmentId);
  if (session.status === "cancelled") throw new ApiError("SESSION_CANCELLED");
  if (session.status === "completed" && ctx.actor.role !== "admin") throw new ApiError("SESSION_CLOSED");

  const existing = activeValidation(ctx, enrollmentId);
  if (!existing) throw new ApiError("ATTENDANCE_NOT_VALIDATED");

  const nowIso = currentTime(ctx).toISOString();
  ctx.db.transaction((tx) => {
    tx.update(attendanceValidations)
      .set({ revokedAt: nowIso, revokedBy: ctx.actor.id, revokeReason: reason })
      .where(eq(attendanceValidations.id, existing.validation.id))
      .run();
    tx.update(enrollments)
      .set({ status: session.status === "completed" ? "absent" : "expected", updatedAt: nowIso })
      .where(eq(enrollments.id, enrollmentId))
      .run();
    writeAudit(tx, {
      actorId: ctx.actor.id,
      action: "ATTENDANCE_CANCELLED",
      entityType: "enrollment",
      entityId: enrollmentId,
      metadata: { sessionId: session.id, validationId: existing.validation.id, reason },
      at: nowIso,
    });
  });
  return { status: "revoked", enrollmentId, revokedAt: nowIso };
}
