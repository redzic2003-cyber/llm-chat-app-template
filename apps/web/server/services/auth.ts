/**
 * Authentification : sessions opaques stockées en base (hash SHA-256 du jeton).
 * - web : cookie HttpOnly/Secure/SameSite=Strict, expiration glissante ;
 * - mobile : jeton Bearer, expiration glissante plus longue.
 * Chaque connexion crée un nouveau jeton (rotation de session après login).
 */
import type { LoginInput } from "@tm/schemas";
import type { UserDTO } from "@tm/shared-types";
import {
  authSessions,
  getDummyHash,
  hashPassword,
  newId,
  users,
  verifyPassword,
  type AppDatabase,
  type User,
} from "@tm/database";
import { and, eq, isNull, lt, ne, or } from "drizzle-orm";
import { ApiError } from "../lib/errors";
import type { Actor } from "../lib/permissions";
import { generateSessionToken, sha256Hex } from "../lib/tokens";
import { writeAudit } from "./audit";
import type { ServiceConfig, ServiceContext } from "./context";
import { currentTime } from "./context";
import { toUserDTO } from "./mappers";

export interface AuthResult {
  user: UserDTO;
  token: string;
  sessionId: string;
  expiresAt: string;
  kind: "web" | "mobile";
}

export interface AuthenticatedSession {
  actor: Actor;
  user: User;
  sessionId: string;
  kind: "web" | "mobile";
  expiresAt: string;
}

const REFRESH_AFTER_MS = 5 * 60_000;

function ttlMs(config: ServiceConfig, kind: "web" | "mobile"): number {
  return kind === "web" ? config.webSessionTtlHours * 3_600_000 : config.mobileSessionTtlDays * 86_400_000;
}

const INVALID_CREDENTIALS = () => new ApiError("UNAUTHORIZED", "Adresse e-mail ou mot de passe incorrect.");

export async function login(
  db: AppDatabase,
  config: ServiceConfig,
  input: LoginInput,
  options: { now?: Date; previousToken?: string | null } = {},
): Promise<AuthResult> {
  const now = options.now ?? new Date();
  const user = db.select().from(users).where(eq(users.email, input.email)).get();
  // Vérification systématique (hash factice si inconnu) : temps de réponse homogène.
  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid || user.disabledAt) {
    writeAudit(db, {
      actorId: user?.id ?? null,
      action: "USER_LOGIN_FAILED",
      entityType: "user",
      entityId: user?.id ?? null,
      metadata: { reason: !user ? "unknown_user" : user.disabledAt ? "disabled" : "bad_password", client: input.client },
      at: now.toISOString(),
    });
    throw INVALID_CREDENTIALS();
  }

  const token = generateSessionToken();
  const kind = input.client;
  const expiresAt = new Date(now.getTime() + ttlMs(config, kind)).toISOString();
  const sessionId = newId();
  db.transaction((tx) => {
    // Rotation : l'éventuelle session présentée lors du login est révoquée.
    if (options.previousToken) {
      tx.update(authSessions)
        .set({ revokedAt: now.toISOString() })
        .where(eq(authSessions.tokenHash, sha256Hex(options.previousToken)))
        .run();
    }
    tx.insert(authSessions)
      .values({
        id: sessionId,
        tokenHash: sha256Hex(token),
        userId: user.id,
        kind,
        deviceName: input.deviceName,
        createdAt: now.toISOString(),
        lastSeenAt: now.toISOString(),
        expiresAt,
      })
      .run();
    // Nettoyage opportuniste des sessions expirées.
    tx.delete(authSessions).where(lt(authSessions.expiresAt, new Date(now.getTime() - 30 * 86_400_000).toISOString())).run();
    writeAudit(tx, { actorId: user.id, action: "USER_LOGIN", entityType: "user", entityId: user.id, metadata: { client: kind }, at: now.toISOString() });
  });

  return { user: toUserDTO(user), token, sessionId, expiresAt, kind };
}

/** Résout un jeton (cookie ou Bearer). Renvoie `null` si inconnu, expiré, révoqué ou compte désactivé. */
export function authenticate(
  db: AppDatabase,
  config: ServiceConfig,
  token: string,
  now: Date = new Date(),
): AuthenticatedSession | null {
  if (!token || token.length > 200) return null;
  const row = db
    .select({ session: authSessions, user: users })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(eq(authSessions.tokenHash, sha256Hex(token)))
    .get();
  if (!row) return null;
  const { session, user } = row;
  if (session.revokedAt || user.disabledAt || Date.parse(session.expiresAt) <= now.getTime()) return null;

  let expiresAt = session.expiresAt;
  if (now.getTime() - Date.parse(session.lastSeenAt) > REFRESH_AFTER_MS) {
    expiresAt = new Date(now.getTime() + ttlMs(config, session.kind)).toISOString();
    db.update(authSessions).set({ lastSeenAt: now.toISOString(), expiresAt }).where(eq(authSessions.id, session.id)).run();
  }
  return {
    actor: { id: user.id, role: user.role, displayName: user.displayName },
    user,
    sessionId: session.id,
    kind: session.kind,
    expiresAt,
  };
}

export function logout(db: AppDatabase, session: AuthenticatedSession, now: Date = new Date()): void {
  db.transaction((tx) => {
    tx.update(authSessions).set({ revokedAt: now.toISOString() }).where(eq(authSessions.id, session.sessionId)).run();
    writeAudit(tx, { actorId: session.user.id, action: "USER_LOGOUT", entityType: "user", entityId: session.user.id, at: now.toISOString() });
  });
}

export async function changeOwnPassword(
  ctx: ServiceContext,
  currentSessionId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  const user = ctx.db.select().from(users).where(eq(users.id, ctx.actor.id)).get();
  if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new ApiError("VALIDATION_ERROR", "Mot de passe actuel incorrect.");
  }
  const now = currentTime(ctx).toISOString();
  const passwordHash = await hashPassword(input.newPassword);
  ctx.db.transaction((tx) => {
    tx.update(users).set({ passwordHash, updatedAt: now }).where(eq(users.id, user.id)).run();
    // Les autres appareils sont déconnectés ; la session courante reste ouverte.
    tx.update(authSessions)
      .set({ revokedAt: now })
      .where(and(eq(authSessions.userId, user.id), ne(authSessions.id, currentSessionId), or(isNull(authSessions.revokedAt))))
      .run();
    writeAudit(tx, { actorId: user.id, action: "USER_PASSWORD_CHANGED", entityType: "user", entityId: user.id, at: now });
  });
}
