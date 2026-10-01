/**
 * Rapports PDF : l'API construit un JSON déjà filtré et autorisé, le service Rust
 * (Krilla) ne fait que la mise en page (docs/blueprint/09-pdf-krilla.md).
 * Le PDF est stocké sur disque, son SHA-256 en base, et vérifié à chaque téléchargement.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  computeSeries,
  breakdownByDepartment,
  breakdownByTraining,
  computeSummary,
  formatDateKey,
  localDateKey,
  localTime,
  periodLabel,
  periodToUtcRange,
  todayKey,
} from "@tm/analytics";
import type { ReportCreateInput } from "@tm/schemas";
import type { PeriodReportType, ReportDTO, ReportPayload, ReportType } from "@tm/shared-types";
import {
  attendanceValidations,
  enrollments,
  newId,
  participants,
  reports,
  trainingSessions,
  trainings,
  users,
} from "@tm/database";
import { and, asc, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { ApiError, notFound } from "../lib/errors";
import { assertCan } from "../lib/permissions";
import { writeAudit } from "./audit";
import { currentTime, type ServiceContext } from "./context";
import { loadSession } from "./sessions";
import { loadStatRows } from "./stats";

function meta(ctx: ServiceContext): NonNullable<ReportPayload["meta"]> {
  const now = currentTime(ctx);
  const tz = ctx.config.timezone;
  return {
    generatedAt: now.toISOString(),
    generatedAtLabel: `${formatDateKey(localDateKey(now, tz))} ${localTime(now, tz)}`,
    generatedBy: ctx.actor.displayName,
    appVersion: ctx.config.appVersion,
    timezone: ctx.config.timezone,
    ...(ctx.config.organization ? { organization: ctx.config.organization } : {}),
  };
}

export function buildPeriodPayload(ctx: ServiceContext, type: PeriodReportType, from: string, to: string): ReportPayload {
  const tz = ctx.config.timezone;
  const period = { from, to };
  const { start, end } = periodToUtcRange(period, tz);
  const { sessions, enrollments: rows } = loadStatRows(ctx.db, { start, end });
  const summary = computeSummary(sessions, rows, currentTime(ctx));
  const label = periodLabel(type, period);

  // Détail des sessions (page 4+ du rapport mensuel).
  const details = sessions.length
    ? ctx.db
        .select({ session: trainingSessions, training: trainings, trainer: users })
        .from(trainingSessions)
        .innerJoin(trainings, eq(trainings.id, trainingSessions.trainingId))
        .innerJoin(users, eq(users.id, trainingSessions.trainerId))
        .where(and(gte(trainingSessions.startsAt, start.toISOString()), lt(trainingSessions.startsAt, end.toISOString())))
        .orderBy(asc(trainingSessions.startsAt))
        .all()
    : [];
  const bySession = new Map<string, { present: number; expected: number }>();
  for (const e of rows) {
    const c = bySession.get(e.sessionId) ?? { present: 0, expected: 0 };
    if (e.status === "present") c.present++;
    if (e.status !== "excused") c.expected++;
    bySession.set(e.sessionId, c);
  }

  return {
    reportType: type,
    title: `Bilan de formation — ${label}`,
    period: { ...period, label },
    meta: meta(ctx),
    summary,
    trainingBreakdown: breakdownByTraining(sessions, rows).map((r) => ({
      reference: r.reference,
      title: r.title,
      participants: r.participants,
      sessions: r.sessions,
      participantHours: r.participantHours,
    })),
    departmentBreakdown: breakdownByDepartment(sessions, rows),
    dailySeries: computeSeries(sessions, rows, "day", period, tz).map((p) => ({ date: p.key, participants: p.participants })),
    weeklySeries: computeSeries(sessions, rows, "week", period, tz).map((p) => ({ week: p.key, participants: p.participants })),
    monthlySeries: computeSeries(sessions, rows, "month", period, tz).map((p) => ({ month: p.key, participants: p.participants })),
    sessions: details.map(({ session, training, trainer }) => ({
      date: formatDateKey(localDateKey(session.startsAt, tz)),
      start: localTime(session.startsAt, tz),
      end: localTime(session.endsAt, tz),
      reference: training.reference,
      title: training.title,
      trainer: trainer.displayName,
      location: session.location,
      status: session.status,
      present: bySession.get(session.id)?.present ?? 0,
      expected: bySession.get(session.id)?.expected ?? 0,
    })),
  };
}

export function buildSessionPayload(ctx: ServiceContext, sessionId: string): ReportPayload {
  const tz = ctx.config.timezone;
  const { session, training, trainer } = loadSession(ctx.db, sessionId);
  const rows = ctx.db
    .select({ enrollment: enrollments, participant: participants, validatedAt: attendanceValidations.validatedAt })
    .from(enrollments)
    .innerJoin(participants, eq(participants.id, enrollments.participantId))
    .leftJoin(
      attendanceValidations,
      and(eq(attendanceValidations.enrollmentId, enrollments.id), isNull(attendanceValidations.revokedAt)),
    )
    .where(eq(enrollments.sessionId, sessionId))
    .orderBy(asc(participants.lastName), asc(participants.firstName))
    .all();
  const statSession = {
    id: session.id,
    trainingId: training.id,
    trainingReference: training.reference,
    trainingTitle: training.title,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    status: session.status,
  };
  const statRows = rows.map((r) => ({
    sessionId,
    participantId: r.participant.id,
    department: r.participant.department,
    status: r.enrollment.status,
  }));
  const day = localDateKey(session.startsAt, tz);
  return {
    reportType: "session",
    title: `Rapport de session — ${training.title}`,
    period: { from: day, to: day, label: formatDateKey(day) },
    meta: meta(ctx),
    summary: computeSummary([statSession], statRows, currentTime(ctx)),
    trainingBreakdown: [],
    dailySeries: [],
    session: {
      reference: training.reference,
      title: training.title,
      date: formatDateKey(day),
      start: localTime(session.startsAt, tz),
      end: localTime(session.endsAt, tz),
      trainer: trainer.displayName,
      location: session.location,
      status: session.status,
      participants: rows.map((r) => ({
        lastName: r.participant.lastName,
        firstName: r.participant.firstName,
        employeeRef: r.participant.employeeRef,
        department: r.participant.department,
        status: r.enrollment.status,
        validatedAt: r.validatedAt ? localTime(r.validatedAt, tz) : null,
      })),
    },
  };
}

export function buildParticipantPayload(ctx: ServiceContext, participantId: string, from?: string, to?: string): ReportPayload {
  const tz = ctx.config.timezone;
  const participant = ctx.db.select().from(participants).where(eq(participants.id, participantId)).get();
  if (!participant) throw notFound("Participant");
  const conditions = [eq(enrollments.participantId, participantId)];
  if (from && to) {
    const range = periodToUtcRange({ from, to }, tz);
    conditions.push(gte(trainingSessions.startsAt, range.start.toISOString()), lt(trainingSessions.startsAt, range.end.toISOString()));
  }
  const rows = ctx.db
    .select({ enrollment: enrollments, session: trainingSessions, training: trainings })
    .from(enrollments)
    .innerJoin(trainingSessions, eq(trainingSessions.id, enrollments.sessionId))
    .innerJoin(trainings, eq(trainings.id, trainingSessions.trainingId))
    .where(and(...conditions))
    .orderBy(asc(trainingSessions.startsAt))
    .all()
    .filter((r) => r.session.status !== "cancelled" && r.session.status !== "draft");

  const lines = rows.map((r) => ({
    date: formatDateKey(localDateKey(r.session.startsAt, tz)),
    reference: r.training.reference,
    title: r.training.title,
    durationHours: Math.round(((Date.parse(r.session.endsAt) - Date.parse(r.session.startsAt)) / 3_600_000) * 100) / 100,
    status: r.enrollment.status,
  }));
  const totalHours = Math.round(lines.filter((l) => l.status === "present").reduce((s, l) => s + l.durationHours, 0) * 100) / 100;
  const periodFrom = from ?? (rows[0] ? localDateKey(rows[0].session.startsAt, tz) : todayKey(tz, currentTime(ctx)));
  const periodTo = to ?? todayKey(tz, currentTime(ctx));
  const present = lines.filter((l) => l.status === "present").length;
  const expected = lines.filter((l) => l.status !== "excused").length;
  const name = `${participant.lastName.toUpperCase()} ${participant.firstName}`;
  return {
    reportType: "participant",
    title: `Historique de formation — ${name}`,
    period: { from: periodFrom, to: periodTo, label: `${formatDateKey(periodFrom)} – ${formatDateKey(periodTo)}` },
    meta: meta(ctx),
    summary: {
      sessions: lines.length,
      participations: present,
      uniqueParticipants: present > 0 ? 1 : 0,
      trainingHours: totalHours,
      participantHours: totalHours,
      attendanceRate: expected > 0 ? Math.round((present / expected) * 1000) / 10 : null,
    },
    trainingBreakdown: [],
    dailySeries: [],
    participant: {
      lastName: participant.lastName,
      firstName: participant.firstName,
      employeeRef: participant.employeeRef,
      department: participant.department,
      totalHours,
      trainings: lines,
    },
  };
}

export function buildPayload(ctx: ServiceContext, input: ReportCreateInput): ReportPayload {
  switch (input.type) {
    case "session":
      return buildSessionPayload(ctx, input.sessionId);
    case "participant":
      return buildParticipantPayload(ctx, input.participantId, input.from, input.to);
    default:
      return buildPeriodPayload(ctx, input.type, input.from, input.to);
  }
}

/** Appelle le service PDF local et vérifie qu'il renvoie bien un PDF. */
export async function renderPdf(ctx: ServiceContext, payload: ReportPayload, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetchImpl(`${ctx.config.pdfServiceUrl.replace(/\/$/, "")}/render`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/pdf" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new ApiError("PDF_SERVICE_UNAVAILABLE");
  }
  if (!response.ok) {
    throw new ApiError("PDF_SERVICE_UNAVAILABLE", `Le service PDF a répondu ${response.status}.`);
  }
  const pdf = Buffer.from(await response.arrayBuffer());
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new ApiError("PDF_SERVICE_UNAVAILABLE", "Réponse inattendue du service PDF.");
  }
  return pdf;
}

function toReportDTO(row: typeof reports.$inferSelect, generatedBy: { id: string; displayName: string }): ReportDTO {
  return {
    id: row.id,
    type: row.type as ReportType,
    title: row.title,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    sha256: row.sha256,
    sizeBytes: row.sizeBytes,
    generatedBy,
    createdAt: row.createdAt,
  };
}

export async function createReport(
  ctx: ServiceContext,
  input: ReportCreateInput,
  fetchImpl: typeof fetch = fetch,
): Promise<ReportDTO> {
  assertCan(ctx.actor, "reports:generate");
  const payload = buildPayload(ctx, input);
  const pdf = await renderPdf(ctx, payload, fetchImpl);
  const sha256 = createHash("sha256").update(pdf).digest("hex");
  const id = newId();
  await mkdir(ctx.config.reportsDir, { recursive: true, mode: 0o700 });
  const filePath = join(ctx.config.reportsDir, `${id}.pdf`);
  await writeFile(filePath, pdf, { mode: 0o600 });

  const now = currentTime(ctx).toISOString();
  const { type, ...params } = input;
  const row = {
    id,
    type,
    title: payload.title ?? payload.period.label,
    periodStart: payload.period.from,
    periodEnd: payload.period.to,
    filePath,
    sha256,
    sizeBytes: pdf.length,
    paramsJson: JSON.stringify(params),
    generatedBy: ctx.actor.id,
    createdAt: now,
  };
  ctx.db.transaction((tx) => {
    tx.insert(reports).values(row).run();
    writeAudit(tx, { actorId: ctx.actor.id, action: "REPORT_GENERATED", entityType: "report", entityId: id, metadata: { type, sha256, ...params }, at: now });
  });
  return toReportDTO(row, { id: ctx.actor.id, displayName: ctx.actor.displayName });
}

export function listReports(ctx: ServiceContext, limit = 100): ReportDTO[] {
  assertCan(ctx.actor, "read");
  return ctx.db
    .select({ report: reports, user: { id: users.id, displayName: users.displayName } })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.generatedBy))
    .orderBy(desc(reports.createdAt))
    .limit(limit)
    .all()
    .map((r) => toReportDTO(r.report, r.user));
}

function loadReport(ctx: ServiceContext, id: string) {
  const row = ctx.db
    .select({ report: reports, user: { id: users.id, displayName: users.displayName } })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.generatedBy))
    .where(eq(reports.id, id))
    .get();
  if (!row) throw notFound("Rapport");
  return row;
}

export function getReport(ctx: ServiceContext, id: string): ReportDTO {
  assertCan(ctx.actor, "read");
  const row = loadReport(ctx, id);
  return toReportDTO(row.report, row.user);
}

/** Lit le PDF et vérifie son empreinte avant de le servir. */
export async function readReportFile(ctx: ServiceContext, id: string): Promise<{ report: ReportDTO; data: Buffer; filename: string }> {
  assertCan(ctx.actor, "read");
  const { report, user } = loadReport(ctx, id);
  let data: Buffer;
  try {
    data = await readFile(report.filePath);
  } catch {
    throw new ApiError("NOT_FOUND", "Fichier du rapport introuvable sur le serveur.");
  }
  if (createHash("sha256").update(data).digest("hex") !== report.sha256) {
    throw new ApiError("INTERNAL_ERROR", "Empreinte du rapport invalide : le fichier a été modifié.");
  }
  const filename = `rapport-${report.type}-${report.periodStart}.pdf`;
  return { report: toReportDTO(report, user), data, filename };
}

