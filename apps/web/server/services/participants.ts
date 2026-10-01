import { participantCreateSchema, type ParticipantCreateInput, type ParticipantUpdateInput } from "@tm/schemas";
import type { ParticipantDTO, ParticipantDetailDTO, ParticipantImportResult } from "@tm/shared-types";
import {
  attendanceValidations,
  enrollments,
  newId,
  participants,
  trainingSessions,
  trainings,
} from "@tm/database";
import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";
import { normalizeHeader, parseCsv } from "../lib/csv";
import { ApiError, conflict, notFound } from "../lib/errors";
import { assertCan } from "../lib/permissions";
import { writeAudit } from "./audit";
import { currentTime, type ServiceContext } from "./context";
import { toParticipantDTO, toTrainingRef } from "./mappers";

/** Minuscules sans accents, pour une recherche tolérante (« celine » trouve « Céline »). */
export function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function listParticipants(
  ctx: ServiceContext,
  query: { q?: string; includeInactive?: boolean; limit: number },
): ParticipantDTO[] {
  assertCan(ctx.actor, "read");
  const rows = ctx.db
    .select()
    .from(participants)
    .where(query.includeInactive ? undefined : eq(participants.active, true))
    .orderBy(asc(participants.lastName), asc(participants.firstName))
    .all();
  const terms = fold(query.q ?? "").split(/\s+/).filter(Boolean);
  const filtered = terms.length
    ? rows.filter((p) => {
        const haystack = fold([p.firstName, p.lastName, p.employeeRef, p.department, p.email].filter(Boolean).join(" "));
        return terms.every((t) => haystack.includes(t));
      })
    : rows;
  return filtered.slice(0, query.limit).map(toParticipantDTO);
}

export function getParticipant(ctx: ServiceContext, id: string): ParticipantDetailDTO {
  assertCan(ctx.actor, "read");
  const p = ctx.db.select().from(participants).where(eq(participants.id, id)).get();
  if (!p) throw notFound("Participant");
  const rows = ctx.db
    .select({
      enrollment: enrollments,
      session: trainingSessions,
      training: trainings,
      validatedAt: attendanceValidations.validatedAt,
    })
    .from(enrollments)
    .innerJoin(trainingSessions, eq(trainingSessions.id, enrollments.sessionId))
    .innerJoin(trainings, eq(trainings.id, trainingSessions.trainingId))
    .leftJoin(
      attendanceValidations,
      and(eq(attendanceValidations.enrollmentId, enrollments.id), isNull(attendanceValidations.revokedAt)),
    )
    .where(eq(enrollments.participantId, id))
    .orderBy(desc(trainingSessions.startsAt))
    .all();

  let sessionsAttended = 0;
  let hours = 0;
  const history = rows.map(({ enrollment, session, training, validatedAt }) => {
    if (enrollment.status === "present" && session.status !== "cancelled") {
      sessionsAttended++;
      hours += (Date.parse(session.endsAt) - Date.parse(session.startsAt)) / 3_600_000;
    }
    return {
      enrollmentId: enrollment.id,
      sessionId: session.id,
      training: toTrainingRef(training),
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      sessionStatus: session.status,
      status: enrollment.status,
      validatedAt: validatedAt ?? null,
    };
  });
  return { ...toParticipantDTO(p), history, totals: { sessionsAttended, hoursAttended: Math.round(hours * 100) / 100 } };
}

function assertEmployeeRefFree(ctx: ServiceContext, employeeRef: string | null | undefined, exceptId?: string) {
  if (!employeeRef) return;
  const clash = ctx.db
    .select({ id: participants.id })
    .from(participants)
    .where(
      exceptId
        ? and(eq(participants.employeeRef, employeeRef), ne(participants.id, exceptId))
        : eq(participants.employeeRef, employeeRef),
    )
    .get();
  if (clash) throw conflict(`Le matricule ${employeeRef} est déjà attribué.`);
}

export function createParticipant(ctx: ServiceContext, input: ParticipantCreateInput): ParticipantDTO {
  assertCan(ctx.actor, "participants:write");
  assertEmployeeRefFree(ctx, input.employeeRef);
  const now = currentTime(ctx).toISOString();
  const row = { id: newId(), ...input, createdAt: now, updatedAt: now };
  ctx.db.transaction((tx) => {
    tx.insert(participants).values(row).run();
    writeAudit(tx, { actorId: ctx.actor.id, action: "PARTICIPANT_CREATED", entityType: "participant", entityId: row.id, at: now });
  });
  return toParticipantDTO(row);
}

export function updateParticipant(ctx: ServiceContext, id: string, input: ParticipantUpdateInput): ParticipantDTO {
  assertCan(ctx.actor, "participants:write");
  const existing = ctx.db.select().from(participants).where(eq(participants.id, id)).get();
  if (!existing) throw notFound("Participant");
  if (input.employeeRef !== undefined) assertEmployeeRefFree(ctx, input.employeeRef, id);
  const now = currentTime(ctx).toISOString();
  ctx.db.transaction((tx) => {
    tx.update(participants).set({ ...input, updatedAt: now }).where(eq(participants.id, id)).run();
    const action = input.active === false && existing.active ? "PARTICIPANT_DEACTIVATED" : "PARTICIPANT_UPDATED";
    // Les valeurs ne sont pas journalisées (données personnelles) : seulement les champs modifiés.
    writeAudit(tx, { actorId: ctx.actor.id, action, entityType: "participant", entityId: id, metadata: { fields: Object.keys(input) }, at: now });
  });
  return toParticipantDTO(ctx.db.select().from(participants).where(eq(participants.id, id)).get()!);
}

const HEADER_ALIASES: Record<string, keyof ParticipantCreateInput> = {
  employee_ref: "employeeRef",
  matricule: "employeeRef",
  ref: "employeeRef",
  reference: "employeeRef",
  first_name: "firstName",
  firstname: "firstName",
  prenom: "firstName",
  last_name: "lastName",
  lastname: "lastName",
  nom: "lastName",
  department: "department",
  departement: "department",
  service: "department",
  email: "email",
  e_mail: "email",
  mail: "email",
};

export const MAX_IMPORT_ROWS = 5000;

/**
 * Import CSV : en-tête obligatoire (nom, prénom, matricule, département, e-mail).
 * Les lignes avec un matricule existant mettent à jour la fiche ; les autres créent
 * un participant. Toute l'opération est transactionnelle.
 */
export function importParticipants(ctx: ServiceContext, csv: string): ParticipantImportResult {
  assertCan(ctx.actor, "participants:import");
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new ApiError("VALIDATION_ERROR", "Le fichier doit contenir un en-tête et au moins une ligne.");
  if (rows.length - 1 > MAX_IMPORT_ROWS) throw new ApiError("VALIDATION_ERROR", `Maximum ${MAX_IMPORT_ROWS} lignes par import.`);

  const header = rows[0]!.map((h) => HEADER_ALIASES[normalizeHeader(h)]);
  if (!header.includes("firstName") || !header.includes("lastName")) {
    throw new ApiError("VALIDATION_ERROR", "Colonnes obligatoires : nom et prénom (first_name, last_name).");
  }

  const result: ParticipantImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const now = currentTime(ctx).toISOString();
  const seenRefs = new Set<string>();

  ctx.db.transaction((tx) => {
    rows.slice(1).forEach((cells, index) => {
      const line = index + 2;
      const raw: Record<string, string> = {};
      header.forEach((field, i) => {
        if (field) raw[field] = cells[i]?.trim() ?? "";
      });
      const parsed = participantCreateSchema.safeParse(raw);
      if (!parsed.success) {
        result.errors.push({ line, message: parsed.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`).join(", ") });
        result.skipped++;
        return;
      }
      const data = parsed.data;
      if (data.employeeRef) {
        if (seenRefs.has(data.employeeRef)) {
          result.errors.push({ line, message: `Matricule ${data.employeeRef} en double dans le fichier.` });
          result.skipped++;
          return;
        }
        seenRefs.add(data.employeeRef);
        const existing = tx.select().from(participants).where(eq(participants.employeeRef, data.employeeRef)).get();
        if (existing) {
          tx.update(participants)
            .set({ firstName: data.firstName, lastName: data.lastName, department: data.department, email: data.email ?? existing.email, updatedAt: now })
            .where(eq(participants.id, existing.id))
            .run();
          result.updated++;
          return;
        }
      }
      tx.insert(participants).values({ id: newId(), ...data, createdAt: now, updatedAt: now }).run();
      result.created++;
    });
    writeAudit(tx, {
      actorId: ctx.actor.id,
      action: "PARTICIPANTS_IMPORTED",
      entityType: "participant",
      metadata: { created: result.created, updated: result.updated, skipped: result.skipped },
      at: now,
    });
  });
  return result;
}
