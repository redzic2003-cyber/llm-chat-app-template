import type { AuditAction, AuditLogDTO } from "@tm/shared-types";
import { auditLogs, newId, users, type DbExecutor } from "@tm/database";
import { and, desc, eq, lt, type SQL } from "drizzle-orm";
import { assertCan } from "../lib/permissions";
import type { ServiceContext } from "./context";

export interface AuditEntry {
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  at?: string;
}

/**
 * Écrit une ligne d'audit. Ne jamais y placer de secret (mot de passe, jeton de
 * session, token QR brut) : seules des références et des résultats.
 */
export function writeAudit(db: DbExecutor, entry: AuditEntry): void {
  db.insert(auditLogs)
    .values({
      id: newId(),
      actorUserId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      timestamp: entry.at ?? new Date().toISOString(),
      metadataJson: entry.metadata ? JSON.stringify(entry.metadata) : null,
    })
    .run();
}

export function listAudit(
  ctx: ServiceContext,
  query: { limit: number; before?: string; entityType?: string; entityId?: string; action?: string },
): AuditLogDTO[] {
  assertCan(ctx.actor, "audit:read");
  const conditions: SQL[] = [];
  if (query.before) conditions.push(lt(auditLogs.id, query.before));
  if (query.entityType) conditions.push(eq(auditLogs.entityType, query.entityType));
  if (query.entityId) conditions.push(eq(auditLogs.entityId, query.entityId));
  if (query.action) conditions.push(eq(auditLogs.action, query.action));
  const rows = ctx.db
    .select({ log: auditLogs, actorName: users.displayName })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.id))
    .limit(query.limit)
    .all();
  return rows.map(({ log, actorName }) => ({
    id: log.id,
    actor: log.actorUserId ? { id: log.actorUserId, displayName: actorName ?? "?" } : null,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    timestamp: log.timestamp,
    metadata: log.metadataJson ? (JSON.parse(log.metadataJson) as Record<string, unknown>) : null,
  }));
}
