/**
 * Émission des QR et résolution des scans (docs/blueprint/04-qr-security.md).
 *
 * - Le token brut (`TRN1:<token>`) n'est renvoyé qu'au moment de l'émission ;
 *   seule son empreinte SHA-256 est stockée.
 * - Un scan ne modifie jamais la présence : il renvoie un aperçu, la validation
 *   est une seconde action explicite.
 * - Chaque scan est journalisé (utilisateur, appareil, résultat) sans le token.
 */
import type { ErrorCode, IssuedQrDTO, ScanResolveResponse, ScanTiming } from "@tm/shared-types";
import { hashPayload, issueToken } from "@tm/qr-core/node";
import {
  attendanceValidations,
  enrollments,
  newId,
  participants,
  qrTokens,
  trainingSessions,
  trainings,
  users,
  type DbExecutor,
  type Enrollment,
  type Participant,
  type TrainingSession,
} from "@tm/database";
import { and, eq, isNull, sql } from "drizzle-orm";
import { ApiError, notFound } from "../lib/errors";
import { assertCanManageSession, canManageSession } from "../lib/permissions";
import { writeAudit } from "./audit";
import { currentTime, type ServiceContext } from "./context";
import { toParticipantRef } from "./mappers";
import { assertSessionOpen, loadSession } from "./sessions";

/** Tolérance autour du créneau pour qualifier un scan d'« en avance » ou « en retard ». */
const TIMING_TOLERANCE_MS = 30 * 60_000;

function issue(
  tx: DbExecutor,
  enrollment: Enrollment,
  participant: Participant,
  session: TrainingSession,
  graceHours: number,
  now: string,
): IssuedQrDTO {
  const { payload, hash } = issueToken();
  const expiresAt = new Date(Date.parse(session.endsAt) + graceHours * 3_600_000).toISOString();
  tx.insert(qrTokens).values({ id: newId(), enrollmentId: enrollment.id, tokenHash: hash, createdAt: now, expiresAt }).run();
  return { enrollmentId: enrollment.id, payload, issuedAt: now, expiresAt, participant: toParticipantRef(participant) };
}

function revokeActive(tx: DbExecutor, enrollmentId: string, now: string): number {
  return tx
    .update(qrTokens)
    .set({ revokedAt: now })
    .where(and(eq(qrTokens.enrollmentId, enrollmentId), isNull(qrTokens.revokedAt)))
    .run().changes;
}

function hasActiveToken(db: DbExecutor, enrollmentId: string): boolean {
  return Boolean(
    db.select({ id: qrTokens.id }).from(qrTokens).where(and(eq(qrTokens.enrollmentId, enrollmentId), isNull(qrTokens.revokedAt))).get(),
  );
}

function loadEnrollmentContext(ctx: ServiceContext, enrollmentId: string) {
  const row = ctx.db
    .select({ enrollment: enrollments, participant: participants })
    .from(enrollments)
    .innerJoin(participants, eq(participants.id, enrollments.participantId))
    .where(eq(enrollments.id, enrollmentId))
    .get();
  if (!row) throw notFound("Inscription");
  const { session } = loadSession(ctx.db, row.enrollment.sessionId);
  assertCanManageSession(ctx.actor, session);
  assertSessionOpen(session);
  return { ...row, session };
}

/** Émet le QR d'une inscription qui n'en a pas encore. */
export function issueQr(ctx: ServiceContext, enrollmentId: string): IssuedQrDTO {
  const { enrollment, participant, session } = loadEnrollmentContext(ctx, enrollmentId);
  if (hasActiveToken(ctx.db, enrollmentId)) throw new ApiError("QR_ALREADY_ISSUED");
  const now = currentTime(ctx).toISOString();
  return ctx.db.transaction((tx) => {
    const issued = issue(tx, enrollment, participant, session, ctx.config.qrGraceHours, now);
    writeAudit(tx, { actorId: ctx.actor.id, action: "QR_GENERATED", entityType: "enrollment", entityId: enrollmentId, at: now });
    return issued;
  });
}

/** Révoque le QR actif (perdu, compromis, réimpression) et en émet un nouveau. */
export function rotateQr(ctx: ServiceContext, enrollmentId: string): IssuedQrDTO {
  const { enrollment, participant, session } = loadEnrollmentContext(ctx, enrollmentId);
  const now = currentTime(ctx).toISOString();
  return ctx.db.transaction((tx) => {
    const revoked = revokeActive(tx, enrollmentId, now);
    const issued = issue(tx, enrollment, participant, session, ctx.config.qrGraceHours, now);
    writeAudit(tx, { actorId: ctx.actor.id, action: "QR_REGENERATED", entityType: "enrollment", entityId: enrollmentId, metadata: { revoked }, at: now });
    return issued;
  });
}

/**
 * Émission groupée pour l'impression des fiches d'une session.
 * `missing` : seulement les inscriptions sans QR actif ; `all` : tout est régénéré
 * (les QR déjà imprimés deviennent inutilisables).
 */
export function issueQrBatch(ctx: ServiceContext, sessionId: string, mode: "missing" | "all"): IssuedQrDTO[] {
  const { session } = loadSession(ctx.db, sessionId);
  assertCanManageSession(ctx.actor, session);
  assertSessionOpen(session);
  const rows = ctx.db
    .select({ enrollment: enrollments, participant: participants })
    .from(enrollments)
    .innerJoin(participants, eq(participants.id, enrollments.participantId))
    .where(eq(enrollments.sessionId, sessionId))
    .orderBy(participants.lastName, participants.firstName)
    .all();
  const now = currentTime(ctx).toISOString();
  return ctx.db.transaction((tx) => {
    const issued: IssuedQrDTO[] = [];
    let revoked = 0;
    for (const { enrollment, participant } of rows) {
      if (enrollment.status === "excused") continue;
      if (mode === "missing" && hasActiveToken(tx, enrollment.id)) continue;
      revoked += revokeActive(tx, enrollment.id, now);
      issued.push(issue(tx, enrollment, participant, session, ctx.config.qrGraceHours, now));
    }
    if (issued.length) {
      writeAudit(tx, {
        actorId: ctx.actor.id,
        action: revoked > 0 ? "QR_REGENERATED" : "QR_GENERATED",
        entityType: "session",
        entityId: sessionId,
        metadata: { mode, issued: issued.length, revoked },
        at: now,
      });
    }
    return issued;
  });
}

export function scanTiming(session: Pick<TrainingSession, "startsAt" | "endsAt">, now: Date): ScanTiming {
  if (now.getTime() < Date.parse(session.startsAt) - TIMING_TOLERANCE_MS) return "early";
  if (now.getTime() > Date.parse(session.endsAt) + TIMING_TOLERANCE_MS) return "late";
  return "on_time";
}

export interface ResolveInput {
  payload: string;
  sessionId?: string;
  deviceId?: string | null;
}

/**
 * Résout un scan : vérifie le format, l'empreinte, la révocation, l'expiration, les
 * droits et la session, puis renvoie l'aperçu sans rien valider.
 */
export function resolveScan(ctx: ServiceContext, input: ResolveInput): ScanResolveResponse {
  const now = currentTime(ctx);
  const nowIso = now.toISOString();

  const fail = (code: ErrorCode, enrollmentId: string | null = null, details?: unknown): never => {
    writeAudit(ctx.db, {
      actorId: ctx.actor.id,
      action: "QR_SCANNED",
      entityType: "enrollment",
      entityId: enrollmentId,
      metadata: { result: code, deviceId: input.deviceId ?? null, sessionId: input.sessionId ?? null },
      at: nowIso,
    });
    throw new ApiError(code, undefined, details);
  };

  const parsed = hashPayload(input.payload);
  if (!parsed.ok) return fail("QR_INVALID");

  const token = ctx.db.select().from(qrTokens).where(eq(qrTokens.tokenHash, parsed.hash)).get();
  if (!token) return fail("QR_NOT_FOUND");

  ctx.db
    .update(qrTokens)
    .set({ scanCount: sql`${qrTokens.scanCount} + 1`, lastScannedAt: nowIso })
    .where(eq(qrTokens.id, token.id))
    .run();

  if (token.revokedAt) return fail("QR_REVOKED", token.enrollmentId);
  if (token.expiresAt && Date.parse(token.expiresAt) <= now.getTime()) return fail("QR_EXPIRED", token.enrollmentId);

  const row = ctx.db
    .select({ enrollment: enrollments, participant: participants, session: trainingSessions, training: trainings })
    .from(enrollments)
    .innerJoin(participants, eq(participants.id, enrollments.participantId))
    .innerJoin(trainingSessions, eq(trainingSessions.id, enrollments.sessionId))
    .innerJoin(trainings, eq(trainings.id, trainingSessions.trainingId))
    .where(eq(enrollments.id, token.enrollmentId))
    .get();
  if (!row) return fail("QR_NOT_FOUND", token.enrollmentId);
  const { enrollment, participant, session, training } = row;

  if (!canManageSession(ctx.actor, session)) return fail("FORBIDDEN", enrollment.id);
  if (input.sessionId && input.sessionId !== session.id) {
    return fail("QR_WRONG_SESSION", enrollment.id, {
      session: { id: session.id, title: training.title, reference: training.reference, startsAt: session.startsAt },
    });
  }
  if (session.status === "cancelled") return fail("SESSION_CANCELLED", enrollment.id);
  if (session.status === "completed") return fail("SESSION_CLOSED", enrollment.id);

  const active = ctx.db
    .select({ validatedAt: attendanceValidations.validatedAt, validatorId: users.id, validatorName: users.displayName })
    .from(attendanceValidations)
    .innerJoin(users, eq(users.id, attendanceValidations.validatedBy))
    .where(and(eq(attendanceValidations.enrollmentId, enrollment.id), isNull(attendanceValidations.revokedAt)))
    .get();

  writeAudit(ctx.db, {
    actorId: ctx.actor.id,
    action: "QR_SCANNED",
    entityType: "enrollment",
    entityId: enrollment.id,
    metadata: { result: active ? "ALREADY_VALIDATED" : "OK", deviceId: input.deviceId ?? null },
    at: nowIso,
  });

  return {
    status: "ok",
    enrollmentId: enrollment.id,
    participant: toParticipantRef(participant),
    session: {
      id: session.id,
      title: training.title,
      reference: training.reference,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      location: session.location,
      status: session.status,
    },
    attendance: active
      ? { status: "validated", validatedAt: active.validatedAt, validatedBy: { id: active.validatorId, displayName: active.validatorName } }
      : { status: "pending" },
    timing: scanTiming(session, now),
  };
}
