import type { SessionCreateInput, SessionUpdateInput } from "@tm/schemas";
import type { EnrollmentCounts, SessionDTO, SessionStatus } from "@tm/shared-types";
import {
  enrollments,
  newId,
  qrTokens,
  trainingSessions,
  trainings,
  users,
  type DbExecutor,
  type Training,
  type TrainingSession,
  type User,
} from "@tm/database";
import { and, asc, eq, gt, inArray, isNull, lt, sql, type SQL } from "drizzle-orm";
import { ApiError, forbidden, notFound } from "../lib/errors";
import { assertCan, assertCanManageSession, can } from "../lib/permissions";
import { writeAudit } from "./audit";
import { currentTime, type ServiceContext } from "./context";
import { EMPTY_COUNTS, toSessionDTO } from "./mappers";

export interface SessionRow {
  session: TrainingSession;
  training: Training;
  trainer: User;
}

export function loadSession(db: DbExecutor, id: string): SessionRow {
  const row = db
    .select({ session: trainingSessions, training: trainings, trainer: users })
    .from(trainingSessions)
    .innerJoin(trainings, eq(trainings.id, trainingSessions.trainingId))
    .innerJoin(users, eq(users.id, trainingSessions.trainerId))
    .where(eq(trainingSessions.id, id))
    .get();
  if (!row) throw notFound("Session");
  return row;
}

export function countsFor(db: DbExecutor, sessionIds: string[]): Map<string, EnrollmentCounts> {
  const result = new Map<string, EnrollmentCounts>();
  if (sessionIds.length === 0) return result;
  const sum = (status: string) => sql<number>`coalesce(sum(case when ${enrollments.status} = ${status} then 1 else 0 end), 0)`;
  const rows = db
    .select({
      sessionId: enrollments.sessionId,
      enrolled: sql<number>`count(*)`,
      present: sum("present"),
      absent: sum("absent"),
      excused: sum("excused"),
      expected: sum("expected"),
      invited: sum("invited"),
    })
    .from(enrollments)
    .where(inArray(enrollments.sessionId, sessionIds))
    .groupBy(enrollments.sessionId)
    .all();
  for (const r of rows) {
    result.set(r.sessionId, {
      enrolled: Number(r.enrolled),
      present: Number(r.present),
      absent: Number(r.absent),
      excused: Number(r.excused),
      pending: Number(r.expected) + Number(r.invited),
    });
  }
  return result;
}

function toDTO(db: DbExecutor, row: SessionRow): SessionDTO {
  return toSessionDTO(row.session, row.training, row.trainer, countsFor(db, [row.session.id]).get(row.session.id) ?? EMPTY_COUNTS);
}

/** Refuse toute action sur une session annulée ou clôturée. */
export function assertSessionOpen(session: Pick<TrainingSession, "status">): void {
  if (session.status === "cancelled") throw new ApiError("SESSION_CANCELLED");
  if (session.status === "completed") throw new ApiError("SESSION_CLOSED");
}

export interface SessionsQuery {
  from?: string;
  to?: string;
  trainerId?: string;
  trainingId?: string;
  mine?: boolean;
  status?: SessionStatus;
}

export function listSessions(ctx: ServiceContext, query: SessionsQuery): SessionDTO[] {
  assertCan(ctx.actor, "read");
  const conditions: SQL[] = [];
  // Chevauchement avec l'intervalle demandé (une session à cheval sur deux semaines apparaît dans les deux).
  if (query.from) conditions.push(gt(trainingSessions.endsAt, query.from));
  if (query.to) conditions.push(lt(trainingSessions.startsAt, query.to));
  if (query.trainingId) conditions.push(eq(trainingSessions.trainingId, query.trainingId));
  if (query.status) conditions.push(eq(trainingSessions.status, query.status));
  const trainerId = query.mine ? ctx.actor.id : query.trainerId;
  if (trainerId) conditions.push(eq(trainingSessions.trainerId, trainerId));

  const rows = ctx.db
    .select({ session: trainingSessions, training: trainings, trainer: users })
    .from(trainingSessions)
    .innerJoin(trainings, eq(trainings.id, trainingSessions.trainingId))
    .innerJoin(users, eq(users.id, trainingSessions.trainerId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(trainingSessions.startsAt))
    .limit(2000)
    .all();
  const counts = countsFor(
    ctx.db,
    rows.map((r) => r.session.id),
  );
  return rows.map((r) => toSessionDTO(r.session, r.training, r.trainer, counts.get(r.session.id) ?? EMPTY_COUNTS));
}

export function getSession(ctx: ServiceContext, id: string): SessionDTO {
  assertCan(ctx.actor, "read");
  return toDTO(ctx.db, loadSession(ctx.db, id));
}

function resolveTrainer(ctx: ServiceContext, trainerId: string | undefined): User {
  const id = trainerId ?? ctx.actor.id;
  if (id !== ctx.actor.id && !can(ctx.actor, "sessions:manage-any")) {
    throw forbidden("Un formateur ne peut planifier que ses propres sessions.");
  }
  const trainer = ctx.db.select().from(users).where(eq(users.id, id)).get();
  if (!trainer || trainer.disabledAt || trainer.role === "viewer") {
    throw new ApiError("VALIDATION_ERROR", "Formateur invalide.", [{ path: "trainerId", message: "Formateur invalide" }]);
  }
  return trainer;
}

function resolveTraining(ctx: ServiceContext, trainingId: string): Training {
  const training = ctx.db.select().from(trainings).where(eq(trainings.id, trainingId)).get();
  if (!training) throw notFound("Formation");
  if (!training.active) throw new ApiError("VALIDATION_ERROR", "Cette formation est désactivée.");
  return training;
}

export function createSession(ctx: ServiceContext, input: SessionCreateInput): SessionDTO {
  assertCan(ctx.actor, "sessions:create");
  const training = resolveTraining(ctx, input.trainingId);
  const trainer = resolveTrainer(ctx, input.trainerId);
  const now = currentTime(ctx).toISOString();
  const row: TrainingSession = {
    id: newId(),
    trainingId: training.id,
    trainerId: trainer.id,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    location: input.location,
    status: input.status,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  ctx.db.transaction((tx) => {
    tx.insert(trainingSessions).values(row).run();
    writeAudit(tx, {
      actorId: ctx.actor.id,
      action: "SESSION_CREATED",
      entityType: "session",
      entityId: row.id,
      metadata: { trainingId: training.id, startsAt: row.startsAt },
      at: now,
    });
  });
  return toSessionDTO(row, training, trainer);
}

export function updateSession(ctx: ServiceContext, id: string, input: SessionUpdateInput): SessionDTO {
  const { session } = loadSession(ctx.db, id);
  assertCanManageSession(ctx.actor, session);
  assertSessionOpen(session);

  const patch: Partial<TrainingSession> = {};
  if (input.trainingId !== undefined && input.trainingId !== session.trainingId) patch.trainingId = resolveTraining(ctx, input.trainingId).id;
  if (input.trainerId !== undefined && input.trainerId !== session.trainerId) patch.trainerId = resolveTrainer(ctx, input.trainerId).id;
  if (input.startsAt !== undefined) patch.startsAt = input.startsAt;
  if (input.endsAt !== undefined) patch.endsAt = input.endsAt;
  if (input.location !== undefined) patch.location = input.location;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.status !== undefined) patch.status = input.status;

  const startsAt = patch.startsAt ?? session.startsAt;
  const endsAt = patch.endsAt ?? session.endsAt;
  if (endsAt <= startsAt) {
    throw new ApiError("VALIDATION_ERROR", "La fin doit suivre le début.", [{ path: "endsAt", message: "La fin doit suivre le début" }]);
  }

  const now = currentTime(ctx).toISOString();
  ctx.db.transaction((tx) => {
    tx.update(trainingSessions).set({ ...patch, updatedAt: now }).where(eq(trainingSessions.id, id)).run();
    // L'expiration des QR actifs suit la fin de session.
    if (patch.endsAt) {
      const expiresAt = new Date(Date.parse(endsAt) + ctx.config.qrGraceHours * 3_600_000).toISOString();
      const ids = tx.select({ id: enrollments.id }).from(enrollments).where(eq(enrollments.sessionId, id)).all().map((e) => e.id);
      if (ids.length) {
        tx.update(qrTokens).set({ expiresAt }).where(and(inArray(qrTokens.enrollmentId, ids), isNull(qrTokens.revokedAt))).run();
      }
    }
    writeAudit(tx, { actorId: ctx.actor.id, action: "SESSION_UPDATED", entityType: "session", entityId: id, metadata: { fields: Object.keys(patch) }, at: now });
  });
  return toDTO(ctx.db, loadSession(ctx.db, id));
}

/** Clôture : les inscrits non validés deviennent absents. */
export function completeSession(ctx: ServiceContext, id: string): SessionDTO {
  const { session } = loadSession(ctx.db, id);
  assertCanManageSession(ctx.actor, session);
  assertSessionOpen(session);
  const now = currentTime(ctx).toISOString();
  ctx.db.transaction((tx) => {
    const marked = tx
      .update(enrollments)
      .set({ status: "absent", updatedAt: now })
      .where(and(eq(enrollments.sessionId, id), inArray(enrollments.status, ["expected", "invited"])))
      .run().changes;
    tx.update(trainingSessions).set({ status: "completed", updatedAt: now }).where(eq(trainingSessions.id, id)).run();
    writeAudit(tx, { actorId: ctx.actor.id, action: "SESSION_COMPLETED", entityType: "session", entityId: id, metadata: { markedAbsent: marked }, at: now });
  });
  return toDTO(ctx.db, loadSession(ctx.db, id));
}

/** Annulation : les QR actifs sont révoqués. */
export function cancelSession(ctx: ServiceContext, id: string, reason: string | null): SessionDTO {
  const { session } = loadSession(ctx.db, id);
  assertCanManageSession(ctx.actor, session);
  assertSessionOpen(session);
  const now = currentTime(ctx).toISOString();
  ctx.db.transaction((tx) => {
    const ids = tx.select({ id: enrollments.id }).from(enrollments).where(eq(enrollments.sessionId, id)).all().map((e) => e.id);
    if (ids.length) {
      tx.update(qrTokens).set({ revokedAt: now }).where(and(inArray(qrTokens.enrollmentId, ids), isNull(qrTokens.revokedAt))).run();
    }
    tx.update(trainingSessions).set({ status: "cancelled", updatedAt: now }).where(eq(trainingSessions.id, id)).run();
    writeAudit(tx, { actorId: ctx.actor.id, action: "SESSION_CANCELLED", entityType: "session", entityId: id, metadata: reason ? { reason } : undefined, at: now });
  });
  return toDTO(ctx.db, loadSession(ctx.db, id));
}
