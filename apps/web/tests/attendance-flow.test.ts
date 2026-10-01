import { auditLogs, qrTokens } from "@tm/database";
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "../server/lib/errors";
import { revokeAttendance, validateAttendance } from "../server/services/attendance";
import { addEnrollments, listEnrollments, setEnrollmentStatus } from "../server/services/enrollments";
import { createParticipant } from "../server/services/participants";
import { issueQr, issueQrBatch, resolveScan, rotateQr } from "../server/services/qr";
import { cancelSession, completeSession, createSession, getSession, updateSession } from "../server/services/sessions";
import { createTraining } from "../server/services/trainings";
import { createUser, ctxFor, testConfig, testDb } from "./helpers";

async function expectApiError(fn: () => unknown, code: string) {
  try {
    await fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(code);
    return error as ApiError;
  }
  throw new Error(`ApiError ${code} attendue`);
}

describe("flux QR → scan → validation", () => {
  const config = testConfig();
  let env: Awaited<ReturnType<typeof setup>>;

  async function setup() {
    const { db } = testDb();
    const admin = await createUser(db, "admin", "Admin");
    const trainer = await createUser(db, "trainer", "Claire");
    const otherTrainer = await createUser(db, "trainer", "Marc");
    const viewer = await createUser(db, "viewer", "Direction");
    const asAdmin = ctxFor(db, admin, config);
    const asTrainer = ctxFor(db, trainer, config);
    const training = createTraining(asAdmin, { reference: "SEC-INC-01", title: "Sécurité incendie", description: null, defaultDurationMinutes: 120, active: true });
    const start = new Date(Date.now() - 10 * 60_000);
    const session = createSession(asAdmin, {
      trainingId: training.id,
      trainerId: trainer.id,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 2 * 3_600_000).toISOString(),
      location: "Local EHS",
      status: "planned",
      notes: null,
    });
    const otherSession = createSession(asAdmin, {
      trainingId: training.id,
      trainerId: trainer.id,
      startsAt: new Date(start.getTime() + 86_400_000).toISOString(),
      endsAt: new Date(start.getTime() + 86_400_000 + 3_600_000).toISOString(),
      location: null,
      status: "planned",
      notes: null,
    });
    const jean = createParticipant(asAdmin, { employeeRef: "E1001", firstName: "Jean", lastName: "Dupont", department: "Production", email: null, active: true });
    const marc = createParticipant(asAdmin, { employeeRef: "E1002", firstName: "Marc", lastName: "Simon", department: "Logistique", email: null, active: true });
    const [eJean, eMarc] = addEnrollments(asTrainer, session.id, [jean.id, marc.id]).sort((a, b) =>
      a.participant.lastName.localeCompare(b.participant.lastName),
    );
    return { db, admin, trainer, otherTrainer, viewer, asAdmin, asTrainer, training, session, otherSession, eJean: eJean!, eMarc: eMarc! };
  }

  beforeEach(async () => {
    env = await setup();
  });

  it("émet des QR sans donnée personnelle et ne stocke que l'empreinte", () => {
    const issued = issueQrBatch(env.asTrainer, env.session.id, "missing");
    expect(issued).toHaveLength(2);
    for (const qr of issued) {
      expect(qr.payload).toMatch(/^TRN1:[A-Za-z0-9_-]{43}$/);
      expect(qr.payload).not.toContain("Dupont");
    }
    const stored = env.db.select().from(qrTokens).all();
    expect(stored).toHaveLength(2);
    for (const row of stored) {
      expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(issued.some((q) => q.payload.includes(row.tokenHash))).toBe(false);
    }
    // Mode « missing » : rien de nouveau ; « all » : tout est régénéré.
    expect(issueQrBatch(env.asTrainer, env.session.id, "missing")).toHaveLength(0);
    expect(issueQrBatch(env.asTrainer, env.session.id, "all")).toHaveLength(2);
    expect(env.db.select().from(qrTokens).all()).toHaveLength(4);
  });

  it("résout, valide une seule fois et gère l'idempotence", async () => {
    const qr = issueQr(env.asTrainer, env.eJean.id);
    await expectApiError(() => issueQr(env.asTrainer, env.eJean.id), "QR_ALREADY_ISSUED");

    const preview = resolveScan(env.asTrainer, { payload: qr.payload, sessionId: env.session.id, deviceId: "pixel-7" });
    expect(preview).toMatchObject({
      status: "ok",
      enrollmentId: env.eJean.id,
      participant: { firstName: "Jean", lastName: "Dupont" },
      session: { reference: "SEC-INC-01", title: "Sécurité incendie" },
      attendance: { status: "pending" },
      timing: "on_time",
    });
    // Le scan seul ne valide rien.
    expect(listEnrollments(env.asTrainer, env.session.id).find((e) => e.id === env.eJean.id)?.status).toBe("expected");

    const validated = validateAttendance(env.asTrainer, env.eJean.id, { idempotencyKey: "key-0001-jean", method: "qr", deviceId: "pixel-7", note: null });
    expect(validated).toMatchObject({ status: "validated", replayed: false, validatedBy: { displayName: "Claire" } });
    expect(getSession(env.asTrainer, env.session.id)).toMatchObject({ status: "in_progress", counts: { present: 1, pending: 1 } });

    const replay = validateAttendance(env.asTrainer, env.eJean.id, { idempotencyKey: "key-0001-jean", method: "qr", deviceId: null, note: null });
    expect(replay).toMatchObject({ replayed: true, validationId: validated.validationId });

    const dup = await expectApiError(
      () => validateAttendance(env.asTrainer, env.eJean.id, { idempotencyKey: "key-0002-jean", method: "qr", deviceId: null, note: null }),
      "ATTENDANCE_ALREADY_VALIDATED",
    );
    expect(dup.details).toMatchObject({ validatedAt: validated.validatedAt, validatedBy: { displayName: "Claire" } });

    expect(resolveScan(env.asTrainer, { payload: qr.payload }).attendance).toMatchObject({ status: "validated" });

    // Annulation puis nouvelle validation possible.
    revokeAttendance(env.asTrainer, env.eJean.id, "erreur de scan");
    await expectApiError(() => revokeAttendance(env.asTrainer, env.eJean.id, null), "ATTENDANCE_NOT_VALIDATED");
    expect(validateAttendance(env.asTrainer, env.eJean.id, { idempotencyKey: "key-0003-jean", method: "qr", deviceId: null, note: null }).replayed).toBe(false);
  });

  it("rejette les QR invalides, inconnus, révoqués, expirés ou d'une autre session", async () => {
    await expectApiError(() => resolveScan(env.asTrainer, { payload: "https://evil.example/123" }), "QR_INVALID");
    await expectApiError(() => resolveScan(env.asTrainer, { payload: "TRN1:" + "A".repeat(43) }), "QR_NOT_FOUND");

    const first = issueQr(env.asTrainer, env.eJean.id);
    const second = rotateQr(env.asTrainer, env.eJean.id);
    await expectApiError(() => resolveScan(env.asTrainer, { payload: first.payload }), "QR_REVOKED");
    expect(resolveScan(env.asTrainer, { payload: second.payload }).status).toBe("ok");

    const wrong = await expectApiError(
      () => resolveScan(env.asTrainer, { payload: second.payload, sessionId: env.otherSession.id }),
      "QR_WRONG_SESSION",
    );
    expect(wrong.details).toMatchObject({ session: { id: env.session.id } });

    const later = ctxFor(env.db, env.trainer, config, new Date(Date.parse(env.session.endsAt) + 25 * 3_600_000));
    await expectApiError(() => resolveScan(later, { payload: second.payload }), "QR_EXPIRED");

    // Journalisation de chaque scan, sans jamais le token brut.
    const logs = env.db.select().from(auditLogs).all().filter((l) => l.action === "QR_SCANNED");
    expect(logs.length).toBeGreaterThanOrEqual(6);
    for (const log of logs) {
      expect(log.metadataJson ?? "").not.toContain(second.payload.slice(5));
      expect(log.metadataJson ?? "").not.toContain(first.payload.slice(5));
    }
  });

  it("applique les droits par rôle", async () => {
    const qr = issueQr(env.asTrainer, env.eJean.id);
    const asOther = ctxFor(env.db, env.otherTrainer, config);
    const asViewer = ctxFor(env.db, env.viewer, config);
    await expectApiError(() => resolveScan(asOther, { payload: qr.payload }), "FORBIDDEN");
    await expectApiError(
      () => validateAttendance(asOther, env.eJean.id, { idempotencyKey: "key-other-01", method: "qr", deviceId: null, note: null }),
      "FORBIDDEN",
    );
    await expectApiError(() => validateAttendance(asViewer, env.eJean.id, { idempotencyKey: "key-view-01", method: "qr", deviceId: null, note: null }), "FORBIDDEN");
    await expectApiError(
      () => createTraining(asViewer, { reference: "X-01", title: "X", description: null, defaultDurationMinutes: null, active: true }),
      "FORBIDDEN",
    );
    await expectApiError(
      () =>
        createSession(asOther, {
          trainingId: env.training.id,
          trainerId: env.trainer.id,
          startsAt: "2026-12-01T08:00:00.000Z",
          endsAt: "2026-12-01T09:00:00.000Z",
          location: null,
          status: "planned",
          notes: null,
        }),
      "FORBIDDEN",
    );
    // L'administrateur peut tout faire.
    expect(resolveScan(env.asAdmin, { payload: qr.payload }).status).toBe("ok");
  });

  it("clôture : absents marqués, QR et validations bloqués", async () => {
    const qr = issueQr(env.asTrainer, env.eMarc.id);
    validateAttendance(env.asTrainer, env.eJean.id, { idempotencyKey: "key-close-01", method: "manual", deviceId: null, note: null });
    const closed = completeSession(env.asTrainer, env.session.id);
    expect(closed).toMatchObject({ status: "completed", counts: { present: 1, absent: 1, pending: 0 } });
    await expectApiError(() => resolveScan(env.asTrainer, { payload: qr.payload }), "SESSION_CLOSED");
    await expectApiError(
      () => validateAttendance(env.asTrainer, env.eMarc.id, { idempotencyKey: "key-close-02", method: "qr", deviceId: null, note: null }),
      "SESSION_CLOSED",
    );
    await expectApiError(() => updateSession(env.asTrainer, env.session.id, { location: "Ailleurs" }), "SESSION_CLOSED");
    // Requalification d'une absence possible après clôture.
    expect(setEnrollmentStatus(env.asTrainer, env.session.id, env.eMarc.id, "excused").status).toBe("excused");
    // Correction administrateur en saisie manuelle.
    expect(
      validateAttendance(env.asAdmin, env.eMarc.id, { idempotencyKey: "key-close-03", method: "manual", deviceId: null, note: "oubli" }).status,
    ).toBe("validated");
  });

  it("annulation : les QR actifs sont révoqués", async () => {
    const qr = issueQr(env.asTrainer, env.eJean.id);
    cancelSession(env.asTrainer, env.session.id, "Formateur malade");
    await expectApiError(() => resolveScan(env.asTrainer, { payload: qr.payload }), "QR_REVOKED");
    await expectApiError(() => addEnrollments(env.asTrainer, env.session.id, [env.eJean.participant.id]), "SESSION_CANCELLED");
  });

  it("décale l'expiration des QR quand la session est déplacée", () => {
    issueQr(env.asTrainer, env.eJean.id);
    const newEnd = new Date(Date.parse(env.session.endsAt) + 48 * 3_600_000).toISOString();
    updateSession(env.asTrainer, env.session.id, { endsAt: newEnd });
    const token = env.db.select().from(qrTokens).get();
    expect(token?.expiresAt).toBe(new Date(Date.parse(newEnd) + 24 * 3_600_000).toISOString());
  });
});
