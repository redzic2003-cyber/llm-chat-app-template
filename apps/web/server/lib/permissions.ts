/**
 * Matrice des droits (docs/blueprint/10-security-backup.md).
 *
 * - admin : tout ;
 * - trainer : consulte, crée et gère ses propres sessions (inscriptions, QR, scan,
 *   validation), génère des rapports ;
 * - viewer : lecture et statistiques uniquement.
 */
import type { Role } from "@tm/shared-types";
import { ApiError } from "./errors";

export const PERMISSIONS = [
  "read",
  "stats:read",
  "trainings:write",
  "participants:write",
  "participants:import",
  "sessions:create",
  "sessions:manage-any",
  "reports:generate",
  "users:manage",
  "audit:read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  trainer: ["read", "stats:read", "sessions:create", "reports:generate"],
  viewer: ["read", "stats:read"],
};

export interface Actor {
  id: string;
  role: Role;
  displayName: string;
}

export function can(actor: Pick<Actor, "role">, permission: Permission): boolean {
  return MATRIX[actor.role].includes(permission);
}

export function assertCan(actor: Pick<Actor, "role">, permission: Permission): void {
  if (!can(actor, permission)) throw new ApiError("FORBIDDEN");
}

/** Gestion d'une session (inscriptions, QR, scans, validations, clôture). */
export function canManageSession(actor: Actor, session: { trainerId: string }): boolean {
  return can(actor, "sessions:manage-any") || (actor.role === "trainer" && session.trainerId === actor.id);
}

export function assertCanManageSession(actor: Actor, session: { trainerId: string }): void {
  if (!canManageSession(actor, session)) {
    throw new ApiError("FORBIDDEN", "Seul le formateur de la session ou un administrateur peut effectuer cette action.");
  }
}
