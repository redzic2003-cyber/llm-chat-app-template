import { readFileSync, writeFileSync } from "node:fs";
import { authSessions } from "@tm/database";
import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "../server/lib/csv";
import { ApiError } from "../server/lib/errors";
import { RateLimiter } from "../server/lib/rate-limit";
import { validateAttendance } from "../server/services/attendance";
import { authenticate, changeOwnPassword, login, logout } from "../server/services/auth";
import { addEnrollments, exportSessionCsv } from "../server/services/enrollments";
import { getParticipant, importParticipants, listParticipants } from "../server/services/participants";
import { createReport, listReports, readReportFile } from "../server/services/reports";
import { createSession } from "../server/services/sessions";
import { dashboardStats } from "../server/services/stats";
import { createTraining } from "../server/services/trainings";
import { updateUser } from "../server/services/users";
import { createUser, ctxFor, testConfig, testDb } from "./helpers";

const config = testConfig();

describe("authentification", () => {
  it("connecte, authentifie, fait tourner et révoque les sessions", async () => {
    const { db } = testDb();
    const admin = await createUser(db, "admin", "Admin", "admin@example.ch");
    const web = await login(db, config, { email: "admin@example.ch", password: "mot-de-passe-test", client: "web", deviceName: null });
    expect(web.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // Le jeton n'est jamais stocké en clair.
    expect(db.select().from(authSessions).all().some((s) => s.tokenHash === web.token)).toBe(false);
    const auth = authenticate(db, config, web.token);
    expect(auth?.actor).toMatchObject({ id: admin.id, role: "admin" });

    // Rotation : un nouveau login avec l'ancien cookie le révoque.
    const again = await login(db, config, { email: "admin@example.ch", password: "mot-de-passe-test", client: "web", deviceName: null }, { previousToken: web.token });
    expect(authenticate(db, config, web.token)).toBeNull();
    expect(authenticate(db, config, again.token)).not.toBeNull();

    // Expiration
    expect(authenticate(db, config, again.token, new Date(Date.now() + 13 * 3_600_000))).toBeNull();

    const mobile = await login(db, config, { email: "admin@example.ch", password: "mot-de-passe-test", client: "mobile", deviceName: "Pixel" });
    expect(Date.parse(mobile.expiresAt) - Date.now()).toBeGreaterThan(29 * 86_400_000);

    // Changement de mot de passe : les autres sessions sont fermées.
    const ctx = ctxFor(db, admin, config);
    await changeOwnPassword(ctx, authenticate(db, config, again.token)!.sessionId, { currentPassword: "mot-de-passe-test", newPassword: "nouveau-mot-de-passe" });
    expect(authenticate(db, config, mobile.token)).toBeNull();
    const current = authenticate(db, config, again.token);
    expect(current).not.toBeNull();
    logout(db, current!);
    expect(authenticate(db, config, again.token)).toBeNull();
  });

  it("refuse les mauvais identifiants et les comptes désactivés", async () => {
    const { db } = testDb();
    const admin = await createUser(db, "admin", "Admin", "admin@example.ch");
    const trainer = await createUser(db, "trainer", "Claire", "claire@example.ch");
    await expect(login(db, config, { email: "admin@example.ch", password: "faux", client: "web", deviceName: null })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(login(db, config, { email: "inconnu@example.ch", password: "faux", client: "web", deviceName: null })).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const session = await login(db, config, { email: "claire@example.ch", password: "mot-de-passe-test", client: "mobile", deviceName: null });
    await updateUser(ctxFor(db, admin, config), trainer.id, { disabled: true });
    expect(authenticate(db, config, session.token)).toBeNull();
    await expect(login(db, config, { email: "claire@example.ch", password: "mot-de-passe-test", client: "web", deviceName: null })).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    // Pas d'auto-rétrogradation du dernier administrateur.
    await expect(updateUser(ctxFor(db, admin, config), admin.id, { role: "viewer" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("participants", () => {
  it("importe un CSV (création + mise à jour par matricule) et recherche sans accents", async () => {
    const { db } = testDb();
    const admin = await createUser(db, "admin");
    const ctx = ctxFor(db, admin, config);
    const csv = [
      "Matricule;Nom;Prénom;Département;E-mail",
      "E1;Dupont;Jean;Production;",
      "E2;Favre;Céline;Qualité;celine.favre@example.ch",
      "E3;;Sans nom;;",
      'E4;"Martin; Jr";Paul;Logistique;',
      "E2;Doublon;X;;",
    ].join("\n");
    expect(importParticipants(ctx, csv)).toEqual({
      created: 3,
      updated: 0,
      skipped: 2,
      errors: [
        { line: 4, message: expect.stringContaining("lastName") },
        { line: 6, message: expect.stringContaining("double") },
      ],
    });
    expect(importParticipants(ctx, "employee_ref,last_name,first_name,department\nE1,Dupont,Jean,Maintenance\n")).toMatchObject({ created: 0, updated: 1 });
    expect(listParticipants(ctx, { q: "celine", limit: 10 }).map((p) => p.lastName)).toEqual(["Favre"]);
    expect(listParticipants(ctx, { q: "maint dup", limit: 10 }).map((p) => p.employeeRef)).toEqual(["E1"]);
    expect(listParticipants(ctx, { q: "jr", limit: 10 })[0]?.lastName).toBe("Martin; Jr");
  });
});

describe("statistiques, export et rapports", () => {
  async function scenario() {
    const { db } = testDb();
    const admin = await createUser(db, "admin");
    const ctx = ctxFor(db, admin, config, new Date("2026-09-20T12:00:00Z"));
    const training = createTraining(ctx, { reference: "SEC-001", title: "Sécurité incendie", description: null, defaultDurationMinutes: 120, active: true });
    const session = createSession(ctx, {
      trainingId: training.id,
      startsAt: "2026-09-03T06:00:00.000Z",
      endsAt: "2026-09-03T08:00:00.000Z",
      location: "Local EHS",
      status: "planned",
      notes: null,
    });
    importParticipants(ctx, "Matricule;Nom;Prénom;Département\nE1;Dupont;Jean;Production\nE2;Simon;Marc;Logistique\nE3;=cmd;Luc;Production\n");
    const people = listParticipants(ctx, { limit: 10 });
    const enrolled = addEnrollments(ctx, session.id, people.map((p) => p.id));
    for (const e of enrolled.filter((x) => x.participant.employeeRef !== "E2")) {
      validateAttendance(ctx, e.id, { idempotencyKey: `k-${e.id}`, method: "manual", deviceId: null, note: null });
    }
    return { db, ctx, training, session, people };
  }

  it("calcule le dashboard depuis la base", async () => {
    const { ctx } = await scenario();
    const stats = dashboardStats(ctx, { from: "2026-09-01", to: "2026-09-30" });
    expect(stats.summary).toMatchObject({
      sessions: 1,
      participations: 2,
      uniqueParticipants: 2,
      trainingHours: 2,
      participantHours: 4,
      attendanceRate: 66.7,
    });
    expect(stats.byDay).toHaveLength(30);
    expect(stats.byTraining[0]).toMatchObject({ reference: "SEC-001", participants: 2 });
    expect(stats.byDepartment).toEqual([{ department: "Production", participants: 2, uniqueParticipants: 2 }]);
    expect(dashboardStats(ctx, { from: "2026-09-01", to: "2026-09-30", department: "Logistique" }).summary.participations).toBe(0);
  });

  it("exporte la liste d'émargement en CSV sûr", async () => {
    const { ctx, session } = await scenario();
    const { filename, content } = exportSessionCsv(ctx, session.id);
    expect(filename).toBe("presences-SEC-001-2026-09-03.csv");
    expect(content.startsWith("﻿Nom;Prénom")).toBe(true);
    expect(content).toContain("'=cmd;Luc");
    expect(content).toContain("Dupont;Jean;E1;Production;Présent;2026-09-20 14:00;admin;manual");
  });

  it("génère, stocke et vérifie un rapport PDF", async () => {
    const { ctx, session } = await scenario();
    const fakePdf = Buffer.from("%PDF-1.7\n% test\n");
    let payload: Record<string, unknown> | undefined;
    const fetchMock = (async (_url: string, init: RequestInit) => {
      payload = JSON.parse(init.body as string);
      return new Response(fakePdf, { status: 200, headers: { "content-type": "application/pdf" } });
    }) as unknown as typeof fetch;

    const monthly = await createReport(ctx, { type: "monthly", from: "2026-09-01", to: "2026-09-30" }, fetchMock);
    expect(monthly).toMatchObject({ type: "monthly", title: "Bilan de formation — Septembre 2026", sizeBytes: fakePdf.length });
    expect(payload).toMatchObject({
      reportType: "monthly",
      period: { from: "2026-09-01", to: "2026-09-30", label: "Septembre 2026" },
      summary: { sessions: 1, participations: 2 },
      trainingBreakdown: [{ reference: "SEC-001", title: "Sécurité incendie", participants: 2 }],
    });
    expect((payload?.sessions as unknown[]).length).toBe(1);

    const file = await readReportFile(ctx, monthly.id);
    expect(file.data.equals(fakePdf)).toBe(true);
    expect(listReports(ctx).map((r) => r.id)).toEqual([monthly.id]);

    const sessionReport = await createReport(ctx, { type: "session", sessionId: session.id }, fetchMock);
    expect(payload).toMatchObject({ reportType: "session", session: { reference: "SEC-001", date: "03.09.2026", start: "08:00" } });
    expect((payload?.session as { participants: unknown[] }).participants).toHaveLength(3);

    // Altération du fichier détectée au téléchargement.
    const path = `${config.reportsDir}/${sessionReport.id}.pdf`;
    writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from("x")]));
    await expect(readReportFile(ctx, sessionReport.id)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });

    // Service PDF indisponible
    const down = (async () => {
      throw new TypeError("ECONNREFUSED");
    }) as unknown as typeof fetch;
    await expect(createReport(ctx, { type: "yearly", from: "2026-01-01", to: "2026-12-31" }, down)).rejects.toMatchObject({ code: "PDF_SERVICE_UNAVAILABLE" });
  });

  it("donne l'historique d'un participant", async () => {
    const { ctx, people } = await scenario();
    const jean = people.find((p) => p.employeeRef === "E1")!;
    expect(getParticipant(ctx, jean.id).totals).toEqual({ sessionsAttended: 1, hoursAttended: 2 });
  });
});

describe("utilitaires", () => {
  it("parse le CSV avec guillemets et séparateurs variés", () => {
    expect(parseCsv('a;b\r\n"x;y";"il dit ""oui"""\n\n')).toEqual([["a", "b"], ["x;y", 'il dit "oui"']]);
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(toCsv(["h"], [["+1"], ["a;b"]])).toBe('﻿h\r\n\'+1\r\n"a;b"\r\n');
  });

  it("limite le débit", () => {
    const limiter = new RateLimiter(2, 1000);
    expect(limiter.hit("k", 0)).toBeNull();
    expect(limiter.hit("k", 10)).toBeNull();
    expect(limiter.hit("k", 20)).toBe(1);
    expect(limiter.hit("k", 1001)).toBeNull();
  });

  it("formate les erreurs", () => {
    expect(new ApiError("QR_REVOKED").status).toBe(410);
    expect(new ApiError("QR_REVOKED").message).toBe("Ce QR n'est plus valide.");
  });
});
