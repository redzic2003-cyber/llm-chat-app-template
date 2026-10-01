import { describe, expect, it } from "vitest";
import {
  breakdownByDepartment,
  breakdownByTraining,
  computeSeries,
  computeSummary,
  type StatEnrollment,
  type StatSession,
} from "../src/stats";

const TZ = "Europe/Zurich";
const NOW = new Date("2026-09-20T12:00:00Z");

const fire = { trainingId: "t1", trainingReference: "SEC-001", trainingTitle: "Sécurité incendie" };
const height = { trainingId: "t2", trainingReference: "TRH-001", trainingTitle: "Travail en hauteur" };

const sessions: StatSession[] = [
  // 2 h, passée
  { id: "s1", ...fire, startsAt: "2026-09-03T06:00:00Z", endsAt: "2026-09-03T08:00:00Z", status: "completed" },
  // 1 h 30, passée
  { id: "s2", ...height, startsAt: "2026-09-10T11:30:00Z", endsAt: "2026-09-10T13:00:00Z", status: "completed" },
  // annulée : ignorée
  { id: "s3", ...fire, startsAt: "2026-09-11T06:00:00Z", endsAt: "2026-09-11T08:00:00Z", status: "cancelled" },
  // future : comptée dans les sessions, pas dans le taux
  { id: "s4", ...fire, startsAt: "2026-09-25T06:00:00Z", endsAt: "2026-09-25T08:00:00Z", status: "planned" },
];

const e = (sessionId: string, participantId: string, status: StatEnrollment["status"], department: string | null = "Production"): StatEnrollment => ({
  sessionId,
  participantId,
  status,
  department,
});

const enrollments: StatEnrollment[] = [
  e("s1", "p1", "present"),
  e("s1", "p2", "present", "Logistique"),
  e("s1", "p3", "absent"),
  e("s1", "p4", "excused"),
  e("s2", "p1", "present"),
  e("s2", "p5", "expected", null), // session terminée, non validé → absence
  e("s3", "p1", "present"), // session annulée
  e("s4", "p2", "expected", "Logistique"),
];

describe("computeSummary", () => {
  it("applique les définitions du blueprint", () => {
    const summary = computeSummary(sessions, enrollments, NOW);
    expect(summary.sessions).toBe(3);
    expect(summary.participations).toBe(3);
    expect(summary.uniqueParticipants).toBe(2);
    expect(summary.trainingHours).toBe(5.5); // 2 + 1.5 + 2
    expect(summary.participantHours).toBe(5.5); // 2×2 + 1.5×1
    // attendus (sessions commencées, hors excusés) : s1 → 3, s2 → 2 ; présents : 3
    expect(summary.expected).toBe(5);
    expect(summary.attendanceRate).toBe(60);
    expect(summary.absences).toBe(2);
    expect(summary.excused).toBe(1);
    expect(summary.averageSessionMinutes).toBe(110);
  });

  it("renvoie un taux nul quand personne n'est attendu", () => {
    const summary = computeSummary([], [], NOW);
    expect(summary).toMatchObject({ sessions: 0, attendanceRate: null, averageSessionMinutes: null });
  });
});

describe("séries et répartitions", () => {
  const period = { from: "2026-09-01", to: "2026-09-30" };

  it("remplit toutes les journées de la période", () => {
    const byDay = computeSeries(sessions, enrollments, "day", period, TZ);
    expect(byDay).toHaveLength(30);
    expect(byDay.find((p) => p.key === "2026-09-03")).toEqual({
      key: "2026-09-03",
      sessions: 1,
      participants: 2,
      participantHours: 4,
    });
    expect(byDay.find((p) => p.key === "2026-09-11")?.sessions).toBe(0);
  });

  it("regroupe par semaine ISO et par mois", () => {
    const byWeek = computeSeries(sessions, enrollments, "week", period, TZ);
    expect(byWeek.map((p) => p.key)).toEqual(["2026-W36", "2026-W37", "2026-W38", "2026-W39", "2026-W40"]);
    expect(byWeek.find((p) => p.key === "2026-W37")?.participants).toBe(1);
    const byMonth = computeSeries(sessions, enrollments, "month", period, TZ);
    expect(byMonth).toEqual([{ key: "2026-09", sessions: 3, participants: 3, participantHours: 5.5 }]);
  });

  it("utilise la date locale et non la date UTC", () => {
    const late: StatSession[] = [
      { id: "x", ...fire, startsAt: "2026-09-30T22:30:00Z", endsAt: "2026-09-30T23:30:00Z", status: "completed" },
    ];
    const byMonth = computeSeries(late, [e("x", "p1", "present")], "month", { from: "2026-09-01", to: "2026-10-31" }, TZ);
    expect(byMonth.map((p) => [p.key, p.participants])).toEqual([
      ["2026-09", 0],
      ["2026-10", 1],
    ]);
  });

  it("répartit par formation et par département", () => {
    expect(breakdownByTraining(sessions, enrollments)).toEqual([
      { trainingId: "t1", reference: "SEC-001", title: "Sécurité incendie", sessions: 2, participants: 2, participantHours: 4 },
      { trainingId: "t2", reference: "TRH-001", title: "Travail en hauteur", sessions: 1, participants: 1, participantHours: 1.5 },
    ]);
    expect(breakdownByDepartment(sessions, enrollments)).toEqual([
      { department: "Production", participants: 2, uniqueParticipants: 1 },
      { department: "Logistique", participants: 1, uniqueParticipants: 1 },
    ]);
  });
});
