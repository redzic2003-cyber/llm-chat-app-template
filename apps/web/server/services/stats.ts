import {
  breakdownByDepartment,
  breakdownByTraining,
  computeSeries,
  computeSummary,
  periodToUtcRange,
  type StatEnrollment,
  type StatSession,
} from "@tm/analytics";
import type { StatsQuery } from "@tm/schemas";
import type { DashboardStats } from "@tm/shared-types";
import { enrollments, participants, trainingSessions, trainings, type DbExecutor } from "@tm/database";
import { and, eq, gte, inArray, lt, type SQL } from "drizzle-orm";
import { assertCan } from "../lib/permissions";
import { currentTime, type ServiceContext } from "./context";

export interface StatFilters {
  start: Date;
  end: Date;
  trainingId?: string;
  trainerId?: string;
  department?: string;
}

/** Charge les sessions dont le début tombe dans `[start, end[` et leurs inscriptions. */
export function loadStatRows(db: DbExecutor, filters: StatFilters): { sessions: StatSession[]; enrollments: StatEnrollment[] } {
  const conditions: SQL[] = [
    gte(trainingSessions.startsAt, filters.start.toISOString()),
    lt(trainingSessions.startsAt, filters.end.toISOString()),
  ];
  if (filters.trainingId) conditions.push(eq(trainingSessions.trainingId, filters.trainingId));
  if (filters.trainerId) conditions.push(eq(trainingSessions.trainerId, filters.trainerId));

  let sessions: StatSession[] = db
    .select({
      id: trainingSessions.id,
      trainingId: trainingSessions.trainingId,
      trainingReference: trainings.reference,
      trainingTitle: trainings.title,
      startsAt: trainingSessions.startsAt,
      endsAt: trainingSessions.endsAt,
      status: trainingSessions.status,
    })
    .from(trainingSessions)
    .innerJoin(trainings, eq(trainings.id, trainingSessions.trainingId))
    .where(and(...conditions))
    .all();

  const ids = sessions.map((s) => s.id);
  let rows: StatEnrollment[] = [];
  // Découpage pour rester sous la limite de variables SQLite.
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    rows = rows.concat(
      db
        .select({
          sessionId: enrollments.sessionId,
          participantId: enrollments.participantId,
          department: participants.department,
          status: enrollments.status,
        })
        .from(enrollments)
        .innerJoin(participants, eq(participants.id, enrollments.participantId))
        .where(inArray(enrollments.sessionId, chunk))
        .all(),
    );
  }

  if (filters.department) {
    const wanted = filters.department.trim().toLowerCase();
    rows = rows.filter((e) => (e.department ?? "").trim().toLowerCase() === wanted);
    const withDept = new Set(rows.map((e) => e.sessionId));
    sessions = sessions.filter((s) => withDept.has(s.id));
  }
  return { sessions, enrollments: rows };
}

export function dashboardStats(ctx: ServiceContext, query: StatsQuery): DashboardStats {
  assertCan(ctx.actor, "stats:read");
  const tz = ctx.config.timezone;
  const period = { from: query.from, to: query.to };
  const { start, end } = periodToUtcRange(period, tz);
  const { sessions, enrollments: rows } = loadStatRows(ctx.db, {
    start,
    end,
    trainingId: query.trainingId,
    trainerId: query.trainerId,
    department: query.department,
  });
  return {
    period,
    timezone: tz,
    summary: computeSummary(sessions, rows, currentTime(ctx)),
    byDay: computeSeries(sessions, rows, "day", period, tz),
    byWeek: computeSeries(sessions, rows, "week", period, tz),
    byMonth: computeSeries(sessions, rows, "month", period, tz),
    byTraining: breakdownByTraining(sessions, rows),
    byDepartment: breakdownByDepartment(sessions, rows),
  };
}
