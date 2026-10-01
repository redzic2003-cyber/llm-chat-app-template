/**
 * Calcul des indicateurs (cf. docs/blueprint/08-statistics.md).
 *
 * Définitions retenues :
 * - une session est comptée si elle n'est ni `draft` ni `cancelled` ;
 * - participations = inscriptions `present` des sessions comptées (une personne
 *   présente à trois sessions compte trois participations) ;
 * - heures de formation = somme des durées des sessions comptées ;
 * - heures-participants = durée × nombre de présents ;
 * - taux de présence = présents / attendus × 100, calculé sur les sessions déjà
 *   commencées, les absences excusées étant exclues des attendus ;
 * - absences = inscriptions `absent` + inscriptions encore en attente sur des
 *   sessions terminées.
 */
import type {
  DepartmentBreakdownRow,
  EnrollmentStatus,
  SeriesPoint,
  SessionStatus,
  StatsSummary,
  TrainingBreakdownRow,
} from "@tm/shared-types";
import { eachDay, eachMonth, eachWeek, isoWeekKey, localDateKey, monthKey, type DateRange } from "./time";

export interface StatSession {
  id: string;
  trainingId: string;
  trainingReference: string;
  trainingTitle: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
}

export interface StatEnrollment {
  sessionId: string;
  participantId: string;
  department: string | null;
  status: EnrollmentStatus;
}

export type Granularity = "day" | "week" | "month";

export const UNKNOWN_DEPARTMENT = "Non renseigné";

export const round1 = (n: number) => Math.round(n * 10) / 10;
export const round2 = (n: number) => Math.round(n * 100) / 100;

export function isCountedSession(session: Pick<StatSession, "status">): boolean {
  return session.status !== "cancelled" && session.status !== "draft";
}

export function sessionDurationHours(session: Pick<StatSession, "startsAt" | "endsAt">): number {
  return Math.max(0, Date.parse(session.endsAt) - Date.parse(session.startsAt)) / 3_600_000;
}

const isPending = (status: EnrollmentStatus) => status === "expected" || status === "invited";

function groupEnrollments(enrollments: StatEnrollment[]): Map<string, StatEnrollment[]> {
  const bySession = new Map<string, StatEnrollment[]>();
  for (const e of enrollments) {
    const list = bySession.get(e.sessionId);
    if (list) list.push(e);
    else bySession.set(e.sessionId, [e]);
  }
  return bySession;
}

export function computeSummary(
  sessions: StatSession[],
  enrollments: StatEnrollment[],
  now: Date = new Date(),
): StatsSummary {
  const bySession = groupEnrollments(enrollments);
  const nowMs = now.getTime();
  const unique = new Set<string>();
  let counted = 0;
  let participations = 0;
  let trainingHours = 0;
  let participantHours = 0;
  let expected = 0;
  let presentOfExpected = 0;
  let absences = 0;
  let excused = 0;
  let totalMinutes = 0;

  for (const session of sessions) {
    if (!isCountedSession(session)) continue;
    counted++;
    const hours = sessionDurationHours(session);
    trainingHours += hours;
    totalMinutes += hours * 60;
    const started = Date.parse(session.startsAt) <= nowMs;
    const ended = Date.parse(session.endsAt) <= nowMs;
    let present = 0;
    for (const e of bySession.get(session.id) ?? []) {
      if (e.status === "present") {
        present++;
        unique.add(e.participantId);
      }
      if (e.status === "excused") excused++;
      if (e.status === "absent" || (ended && isPending(e.status))) absences++;
      if (started && e.status !== "excused") {
        expected++;
        if (e.status === "present") presentOfExpected++;
      }
    }
    participations += present;
    participantHours += hours * present;
  }

  return {
    sessions: counted,
    participations,
    uniqueParticipants: unique.size,
    trainingHours: round2(trainingHours),
    participantHours: round2(participantHours),
    attendanceRate: expected > 0 ? round1((presentOfExpected / expected) * 100) : null,
    expected,
    absences,
    excused,
    averageSessionMinutes: counted > 0 ? Math.round(totalMinutes / counted) : null,
  };
}

export function bucketKey(dateKey: string, granularity: Granularity): string {
  if (granularity === "day") return dateKey;
  if (granularity === "week") return isoWeekKey(dateKey);
  return monthKey(dateKey);
}

/** Série complète (périodes vides incluses) des participations par jour/semaine/mois. */
export function computeSeries(
  sessions: StatSession[],
  enrollments: StatEnrollment[],
  granularity: Granularity,
  period: DateRange,
  timeZone: string,
): SeriesPoint[] {
  const keys =
    granularity === "day"
      ? eachDay(period.from, period.to)
      : granularity === "week"
        ? eachWeek(period.from, period.to)
        : eachMonth(period.from, period.to);
  const points = new Map<string, SeriesPoint>(
    keys.map((key) => [key, { key, sessions: 0, participants: 0, participantHours: 0 }]),
  );
  const bySession = groupEnrollments(enrollments);

  for (const session of sessions) {
    if (!isCountedSession(session)) continue;
    const point = points.get(bucketKey(localDateKey(session.startsAt, timeZone), granularity));
    if (!point) continue;
    const present = (bySession.get(session.id) ?? []).filter((e) => e.status === "present").length;
    point.sessions++;
    point.participants += present;
    point.participantHours += sessionDurationHours(session) * present;
  }

  return [...points.values()].map((p) => ({ ...p, participantHours: round2(p.participantHours) }));
}

export function breakdownByTraining(sessions: StatSession[], enrollments: StatEnrollment[]): TrainingBreakdownRow[] {
  const bySession = groupEnrollments(enrollments);
  const rows = new Map<string, TrainingBreakdownRow>();
  for (const session of sessions) {
    if (!isCountedSession(session)) continue;
    let row = rows.get(session.trainingId);
    if (!row) {
      row = {
        trainingId: session.trainingId,
        reference: session.trainingReference,
        title: session.trainingTitle,
        sessions: 0,
        participants: 0,
        participantHours: 0,
      };
      rows.set(session.trainingId, row);
    }
    const present = (bySession.get(session.id) ?? []).filter((e) => e.status === "present").length;
    row.sessions++;
    row.participants += present;
    row.participantHours += sessionDurationHours(session) * present;
  }
  return [...rows.values()]
    .map((r) => ({ ...r, participantHours: round2(r.participantHours) }))
    .sort((a, b) => b.participants - a.participants || a.title.localeCompare(b.title, "fr"));
}

export function breakdownByDepartment(
  sessions: StatSession[],
  enrollments: StatEnrollment[],
): DepartmentBreakdownRow[] {
  const counted = new Set(sessions.filter(isCountedSession).map((s) => s.id));
  const rows = new Map<string, { participants: number; unique: Set<string> }>();
  for (const e of enrollments) {
    if (e.status !== "present" || !counted.has(e.sessionId)) continue;
    const department = e.department?.trim() || UNKNOWN_DEPARTMENT;
    let row = rows.get(department);
    if (!row) {
      row = { participants: 0, unique: new Set() };
      rows.set(department, row);
    }
    row.participants++;
    row.unique.add(e.participantId);
  }
  return [...rows.entries()]
    .map(([department, r]) => ({ department, participants: r.participants, uniqueParticipants: r.unique.size }))
    .sort((a, b) => b.participants - a.participants || a.department.localeCompare(b.department, "fr"));
}
