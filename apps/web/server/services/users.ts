import type { UserCreateInput, UserUpdateInput } from "@tm/schemas";
import type { Role, UserDTO, UserRef } from "@tm/shared-types";
import { authSessions, hashPassword, newId, users } from "@tm/database";
import { and, asc, count, eq, inArray, isNull, ne } from "drizzle-orm";
import { ApiError, conflict, notFound } from "../lib/errors";
import { assertCan } from "../lib/permissions";
import { writeAudit } from "./audit";
import { currentTime, type ServiceContext } from "./context";
import { toUserDTO } from "./mappers";

export function listUsers(ctx: ServiceContext, query: { role?: Role; includeDisabled?: boolean }): UserDTO[] {
  assertCan(ctx.actor, "users:manage");
  const conditions = [];
  if (query.role) conditions.push(eq(users.role, query.role));
  if (!query.includeDisabled) conditions.push(isNull(users.disabledAt));
  return ctx.db
    .select()
    .from(users)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(users.displayName))
    .all()
    .map(toUserDTO);
}

/** Formateurs sélectionnables (formateurs et administrateurs actifs) — accessible à tous les rôles. */
export function listTrainers(ctx: ServiceContext): (UserRef & { role: Role })[] {
  return ctx.db
    .select({ id: users.id, displayName: users.displayName, role: users.role })
    .from(users)
    .where(and(inArray(users.role, ["admin", "trainer"]), isNull(users.disabledAt)))
    .orderBy(asc(users.displayName))
    .all();
}

export async function createUser(ctx: ServiceContext, input: UserCreateInput): Promise<UserDTO> {
  assertCan(ctx.actor, "users:manage");
  const existing = ctx.db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).get();
  if (existing) throw conflict("Un compte existe déjà avec cette adresse e-mail.");
  const now = currentTime(ctx).toISOString();
  const row = {
    id: newId(),
    email: input.email,
    displayName: input.displayName,
    role: input.role,
    passwordHash: await hashPassword(input.password),
    createdAt: now,
    updatedAt: now,
  };
  ctx.db.transaction((tx) => {
    tx.insert(users).values(row).run();
    writeAudit(tx, { actorId: ctx.actor.id, action: "USER_CREATED", entityType: "user", entityId: row.id, metadata: { role: row.role }, at: now });
  });
  return toUserDTO({ ...row, authSubject: null, disabledAt: null });
}

function activeAdminCount(ctx: ServiceContext, excludeId: string): number {
  return (
    ctx.db
      .select({ n: count() })
      .from(users)
      .where(and(eq(users.role, "admin"), isNull(users.disabledAt), ne(users.id, excludeId)))
      .get()?.n ?? 0
  );
}

export async function updateUser(ctx: ServiceContext, id: string, input: UserUpdateInput): Promise<UserDTO> {
  assertCan(ctx.actor, "users:manage");
  const user = ctx.db.select().from(users).where(eq(users.id, id)).get();
  if (!user) throw notFound("Utilisateur");

  const demoting = input.role !== undefined && input.role !== "admin" && user.role === "admin";
  const disabling = input.disabled === true && !user.disabledAt;
  if ((demoting || disabling) && id === ctx.actor.id) {
    throw new ApiError("CONFLICT", "Vous ne pouvez pas retirer vos propres droits d'administration.");
  }
  if ((demoting || (disabling && user.role === "admin")) && activeAdminCount(ctx, id) === 0) {
    throw new ApiError("CONFLICT", "Au moins un administrateur actif est nécessaire.");
  }

  const now = currentTime(ctx).toISOString();
  const patch: Partial<typeof users.$inferInsert> = { updatedAt: now };
  if (input.displayName !== undefined) patch.displayName = input.displayName;
  if (input.role !== undefined) patch.role = input.role;
  if (input.disabled !== undefined) patch.disabledAt = input.disabled ? (user.disabledAt ?? now) : null;
  if (input.password !== undefined) patch.passwordHash = await hashPassword(input.password);

  ctx.db.transaction((tx) => {
    tx.update(users).set(patch).where(eq(users.id, id)).run();
    // Changement de mot de passe ou désactivation : toutes les sessions ouvertes sont révoquées.
    if (input.password !== undefined || disabling) {
      tx.update(authSessions).set({ revokedAt: now }).where(and(eq(authSessions.userId, id), isNull(authSessions.revokedAt))).run();
    }
    if (input.role !== undefined && input.role !== user.role) {
      writeAudit(tx, { actorId: ctx.actor.id, action: "USER_ROLE_CHANGED", entityType: "user", entityId: id, metadata: { from: user.role, to: input.role }, at: now });
    }
    if (disabling) writeAudit(tx, { actorId: ctx.actor.id, action: "USER_DISABLED", entityType: "user", entityId: id, at: now });
    if (input.password !== undefined) writeAudit(tx, { actorId: ctx.actor.id, action: "USER_PASSWORD_CHANGED", entityType: "user", entityId: id, at: now });
    if (input.displayName !== undefined || input.disabled === false) {
      writeAudit(tx, { actorId: ctx.actor.id, action: "USER_UPDATED", entityType: "user", entityId: id, metadata: { fields: Object.keys(input) }, at: now });
    }
  });
  return toUserDTO(ctx.db.select().from(users).where(eq(users.id, id)).get()!);
}
