import type { TrainingCreateInput, TrainingUpdateInput } from "@tm/schemas";
import type { TrainingDTO } from "@tm/shared-types";
import { newId, trainings } from "@tm/database";
import { and, asc, eq, ne } from "drizzle-orm";
import { conflict, notFound } from "../lib/errors";
import { assertCan } from "../lib/permissions";
import { writeAudit } from "./audit";
import { currentTime, type ServiceContext } from "./context";
import { toTrainingDTO } from "./mappers";

export function listTrainings(ctx: ServiceContext, query: { includeInactive?: boolean }): TrainingDTO[] {
  assertCan(ctx.actor, "read");
  return ctx.db
    .select()
    .from(trainings)
    .where(query.includeInactive ? undefined : eq(trainings.active, true))
    .orderBy(asc(trainings.title))
    .all()
    .map(toTrainingDTO);
}

export function getTraining(ctx: ServiceContext, id: string): TrainingDTO {
  assertCan(ctx.actor, "read");
  const row = ctx.db.select().from(trainings).where(eq(trainings.id, id)).get();
  if (!row) throw notFound("Formation");
  return toTrainingDTO(row);
}

function assertReferenceFree(ctx: ServiceContext, reference: string, exceptId?: string) {
  const clash = ctx.db
    .select({ id: trainings.id })
    .from(trainings)
    .where(exceptId ? and(eq(trainings.reference, reference), ne(trainings.id, exceptId)) : eq(trainings.reference, reference))
    .get();
  if (clash) throw conflict(`La référence ${reference} est déjà utilisée.`);
}

export function createTraining(ctx: ServiceContext, input: TrainingCreateInput): TrainingDTO {
  assertCan(ctx.actor, "trainings:write");
  assertReferenceFree(ctx, input.reference);
  const now = currentTime(ctx).toISOString();
  const row = { id: newId(), ...input, createdAt: now, updatedAt: now };
  ctx.db.transaction((tx) => {
    tx.insert(trainings).values(row).run();
    writeAudit(tx, { actorId: ctx.actor.id, action: "TRAINING_CREATED", entityType: "training", entityId: row.id, metadata: { reference: row.reference }, at: now });
  });
  return toTrainingDTO(row);
}

export function updateTraining(ctx: ServiceContext, id: string, input: TrainingUpdateInput): TrainingDTO {
  assertCan(ctx.actor, "trainings:write");
  const existing = ctx.db.select().from(trainings).where(eq(trainings.id, id)).get();
  if (!existing) throw notFound("Formation");
  if (input.reference && input.reference !== existing.reference) assertReferenceFree(ctx, input.reference, id);
  const now = currentTime(ctx).toISOString();
  ctx.db.transaction((tx) => {
    tx.update(trainings).set({ ...input, updatedAt: now }).where(eq(trainings.id, id)).run();
    const action = input.active === false && existing.active ? "TRAINING_DEACTIVATED" : "TRAINING_UPDATED";
    writeAudit(tx, { actorId: ctx.actor.id, action, entityType: "training", entityId: id, metadata: { fields: Object.keys(input) }, at: now });
  });
  return toTrainingDTO(ctx.db.select().from(trainings).where(eq(trainings.id, id)).get()!);
}

/** Suppression logique : la formation reste liée à l'historique des sessions. */
export function deactivateTraining(ctx: ServiceContext, id: string): TrainingDTO {
  return updateTraining(ctx, id, { active: false });
}
