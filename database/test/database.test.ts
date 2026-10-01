import { count, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { seedAdmin, seedDemo } from "../seeds/seed";
import {
  attendanceValidations,
  checkIntegrity,
  enrollments,
  hashPassword,
  newId,
  openDatabase,
  participants,
  qrTokens,
  runMigrations,
  trainingSessions,
  trainings,
  users,
  uuidv7,
  verifyPassword,
  type OpenedDatabase,
} from "../src/index";

let opened: OpenedDatabase | undefined;
afterEach(() => opened?.close());

function freshDb() {
  opened = openDatabase(":memory:");
  runMigrations(opened.db);
  return opened;
}

describe("base de données", () => {
  it("applique la configuration et les migrations", () => {
    const { sqlite } = freshDb();
    expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(sqlite.pragma("busy_timeout", { simple: true })).toBe(5000);
    expect(checkIntegrity(sqlite)).toMatchObject({ integrity: "ok", foreignKeyViolations: 0 });
  });

  it("garantit une seule présence active et un seul QR actif par inscription", async () => {
    const { db } = freshDb();
    const now = new Date().toISOString();
    const admin = await seedAdmin(db, { email: "admin@example.ch", password: "correct horse battery" });
    const trainingId = newId();
    db.insert(trainings).values({ id: trainingId, reference: "SEC-001", title: "Sécurité", createdAt: now, updatedAt: now }).run();
    const sessionId = newId();
    db.insert(trainingSessions)
      .values({ id: sessionId, trainingId, trainerId: admin.id, startsAt: "2026-10-15T06:00:00.000Z", endsAt: "2026-10-15T08:00:00.000Z", createdAt: now, updatedAt: now })
      .run();
    const participantId = newId();
    db.insert(participants).values({ id: participantId, firstName: "Jean", lastName: "Dupont", createdAt: now, updatedAt: now }).run();
    const enrollmentId = newId();
    db.insert(enrollments).values({ id: enrollmentId, sessionId, participantId, createdAt: now, updatedAt: now }).run();

    // Doublon d'inscription
    expect(() =>
      db.insert(enrollments).values({ id: newId(), sessionId, participantId, createdAt: now, updatedAt: now }).run(),
    ).toThrow(/UNIQUE/);

    const validation = { enrollmentId, validatedBy: admin.id, validatedAt: now };
    db.insert(attendanceValidations).values({ id: newId(), ...validation }).run();
    expect(() => db.insert(attendanceValidations).values({ id: newId(), ...validation }).run()).toThrow(/UNIQUE/);
    // Après annulation, une nouvelle validation est possible (historique conservé).
    db.update(attendanceValidations).set({ revokedAt: now }).where(eq(attendanceValidations.enrollmentId, enrollmentId)).run();
    db.insert(attendanceValidations).values({ id: newId(), ...validation }).run();
    expect(db.select({ n: count() }).from(attendanceValidations).get()?.n).toBe(2);

    db.insert(qrTokens).values({ id: newId(), enrollmentId, tokenHash: "a".repeat(64), createdAt: now }).run();
    expect(() => db.insert(qrTokens).values({ id: newId(), enrollmentId, tokenHash: "b".repeat(64), createdAt: now }).run()).toThrow(/UNIQUE/);

    // Contrainte horaire
    expect(() =>
      db.insert(trainingSessions)
        .values({ id: newId(), trainingId, trainerId: admin.id, startsAt: "2026-10-15T08:00:00.000Z", endsAt: "2026-10-15T06:00:00.000Z", createdAt: now, updatedAt: now })
        .run(),
    ).toThrow(/CHECK/);
  });

  it("crée l'administrateur une seule fois", async () => {
    const { db } = freshDb();
    const first = await seedAdmin(db, { email: "Admin@Example.ch", password: "correct horse battery" });
    const second = await seedAdmin(db, { email: "admin@example.ch", password: "correct horse battery" });
    expect(first.created).toBe(true);
    expect(second).toEqual({ created: false, id: first.id });
    const user = db.select().from(users).get();
    expect(user?.email).toBe("admin@example.ch");
    expect(await verifyPassword("correct horse battery", user?.passwordHash)).toBe(true);
  });

  it("génère un jeu de démonstration cohérent", async () => {
    const { db, sqlite } = freshDb();
    const result = await seedDemo(db, { password: "demo-formation-2026", timezone: "Europe/Zurich", now: new Date("2026-10-01T10:00:00Z") });
    expect(result.skipped).toBe(false);
    expect(result.sessions).toBeGreaterThan(40);
    expect(checkIntegrity(sqlite)).toMatchObject({ integrity: "ok", foreignKeyViolations: 0 });
    expect((await seedDemo(db, { password: "x".repeat(12), timezone: "Europe/Zurich" })).skipped).toBe(true);
  });
});

describe("utilitaires", () => {
  it("génère des UUIDv7 triables", () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_000_001);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });

  it("hache et vérifie les mots de passe", async () => {
    const hash = await hashPassword("un mot de passe solide");
    expect(hash.startsWith("scrypt$32768$8$1$")).toBe(true);
    expect(await verifyPassword("un mot de passe solide", hash)).toBe(true);
    expect(await verifyPassword("mauvais", hash)).toBe(false);
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "md5$abc")).toBe(false);
  });
});
