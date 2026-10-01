import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../schema/schema";

export type AppDatabase = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

/** Base ou transaction : permet d'écrire des helpers utilisables dans `db.transaction()`. */
export type DbExecutor = BaseSQLiteDatabase<"sync", Database.RunResult, typeof schema>;

export interface OpenedDatabase {
  db: AppDatabase;
  sqlite: Database.Database;
  close: () => void;
}

/** Dossier des migrations versionnées livré avec ce paquet. */
export const DEFAULT_MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../migrations");

/**
 * Ouvre la base et applique la configuration recommandée (docs/blueprint/02-database-sqlite.md) :
 * WAL, synchronous NORMAL, clés étrangères, busy_timeout. Le fichier est créé en 0600
 * dans un répertoire 0700.
 */
export function openDatabase(file: string, options: { readonly?: boolean } = {}): OpenedDatabase {
  const inMemory = file === ":memory:";
  if (!inMemory && !options.readonly) {
    const dir = dirname(resolve(file));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const sqlite = new Database(file, options.readonly ? { readonly: true, fileMustExist: true } : {});
  if (!inMemory && !options.readonly) {
    sqlite.pragma("journal_mode = WAL");
    try {
      chmodSync(file, 0o600);
    } catch {
      // Système de fichiers sans permissions POSIX : ignoré.
    }
  }
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  const db = drizzle(sqlite, { schema }) as AppDatabase;
  return {
    db,
    sqlite,
    close: () => {
      if (sqlite.open) sqlite.close();
    },
  };
}

export function runMigrations(db: AppDatabase, migrationsFolder: string = DEFAULT_MIGRATIONS_DIR): void {
  migrate(db, { migrationsFolder });
}

/** Sauvegarde cohérente via l'API backup de SQLite (équivalent de `.backup`). */
export async function backupDatabase(sqlite: Database.Database, destination: string): Promise<void> {
  mkdirSync(dirname(resolve(destination)), { recursive: true, mode: 0o700 });
  await sqlite.backup(destination);
  try {
    chmodSync(destination, 0o600);
  } catch {
    // ignoré
  }
}

export interface IntegrityReport {
  integrity: string;
  foreignKeyViolations: number;
  counts: Record<string, number>;
}

export function checkIntegrity(sqlite: Database.Database): IntegrityReport {
  const integrity = (sqlite.pragma("integrity_check", { simple: true }) as string) ?? "unknown";
  const fkViolations = (sqlite.pragma("foreign_key_check") as unknown[]).length;
  const counts: Record<string, number> = {};
  for (const table of [
    "users",
    "participants",
    "trainings",
    "training_sessions",
    "enrollments",
    "qr_tokens",
    "attendance_validations",
    "audit_logs",
    "reports",
  ]) {
    const row = sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number } | undefined;
    counts[table] = row?.n ?? 0;
  }
  return { integrity, foreignKeyViolations: fkViolations, counts };
}
