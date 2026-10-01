import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashPassword, newId, openDatabase, runMigrations, users, type AppDatabase } from "@tm/database";
import type { Role } from "@tm/shared-types";
import type { Actor } from "../server/lib/permissions";
import type { ServiceConfig, ServiceContext } from "../server/services/context";

export function testConfig(overrides: Partial<ServiceConfig> = {}): ServiceConfig {
  return {
    timezone: "Europe/Zurich",
    qrGraceHours: 24,
    reportsDir: mkdtempSync(join(tmpdir(), "tm-reports-")),
    pdfServiceUrl: "http://pdf.test",
    appVersion: "test",
    organization: "",
    webSessionTtlHours: 12,
    mobileSessionTtlDays: 30,
    ...overrides,
  };
}

export function testDb(): { db: AppDatabase; close: () => void } {
  const opened = openDatabase(":memory:");
  runMigrations(opened.db);
  return { db: opened.db, close: opened.close };
}

let cachedHash: string | undefined;

export async function createUser(db: AppDatabase, role: Role, name = role, email = `${name}@example.ch`): Promise<Actor> {
  cachedHash ??= await hashPassword("mot-de-passe-test");
  const now = new Date().toISOString();
  const id = newId();
  db.insert(users).values({ id, email, displayName: name, role, passwordHash: cachedHash, createdAt: now, updatedAt: now }).run();
  return { id, role, displayName: name };
}

export function ctxFor(db: AppDatabase, actor: Actor, config: ServiceConfig, now?: Date): ServiceContext {
  return { db, actor, config, now: now ? () => now : undefined };
}
