import { openDatabase, runMigrations, type OpenedDatabase } from "@tm/database";

let instance: OpenedDatabase | undefined;

/** Connexion SQLite unique du processus (better-sqlite3 est synchrone et thread-safe ici). */
export function useDatabase(): OpenedDatabase {
  if (!instance) {
    const config = useRuntimeConfig();
    instance = openDatabase(config.databasePath);
    if (config.autoMigrate === true || String(config.autoMigrate) === "true") {
      runMigrations(instance.db, config.migrationsDir);
      log("info", "db.migrated", { migrationsDir: config.migrationsDir });
    }
    log("info", "db.opened", { journalMode: instance.sqlite.pragma("journal_mode", { simple: true }) });
  }
  return instance;
}

export const useDb = () => useDatabase().db;

export function closeDatabase(): void {
  instance?.close();
  instance = undefined;
}
