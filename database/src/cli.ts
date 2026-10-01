#!/usr/bin/env -S npx tsx
/**
 * Outils d'exploitation de la base :
 *   tm-db migrate                 applique les migrations Drizzle
 *   tm-db seed [--demo]           crée l'administrateur (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
 *   tm-db backup <fichier>        sauvegarde cohérente (API backup SQLite)
 *   tm-db integrity [fichier]     PRAGMA integrity_check + comptages (test de restauration)
 *
 * Base : NUXT_DATABASE_PATH (défaut : <repo>/data/app.sqlite3).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_TIMEZONE } from "@tm/analytics";
import { seedAdmin, seedDemo } from "../seeds/seed";
import { DEFAULT_MIGRATIONS_DIR, backupDatabase, checkIntegrity, openDatabase, runMigrations } from "./client";

const DEFAULT_DB = resolve(DEFAULT_MIGRATIONS_DIR, "../../data/app.sqlite3");
const dbPath = process.env.NUXT_DATABASE_PATH ?? DEFAULT_DB;
const [command, ...args] = process.argv.slice(2);

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level: "info", event, ...data }));
}

async function main() {
  switch (command) {
    case "migrate": {
      const { db, close } = openDatabase(dbPath);
      runMigrations(db, process.env.NUXT_MIGRATIONS_DIR ?? DEFAULT_MIGRATIONS_DIR);
      close();
      log("db.migrated", { database: dbPath });
      return;
    }
    case "seed": {
      const { db, close } = openDatabase(dbPath);
      runMigrations(db, process.env.NUXT_MIGRATIONS_DIR ?? DEFAULT_MIGRATIONS_DIR);
      const email = process.env.SEED_ADMIN_EMAIL;
      const password = process.env.SEED_ADMIN_PASSWORD;
      if (!email || !password) {
        throw new Error("Définissez SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD (12 caractères minimum).");
      }
      const admin = await seedAdmin(db, { email, password, displayName: process.env.SEED_ADMIN_NAME });
      log("db.seed.admin", { created: admin.created });
      if (args.includes("--demo")) {
        const demo = await seedDemo(db, {
          password: process.env.SEED_DEMO_PASSWORD ?? "demo-formation-2026",
          timezone: process.env.NUXT_PUBLIC_TIMEZONE ?? DEFAULT_TIMEZONE,
        });
        log("db.seed.demo", demo);
      }
      close();
      return;
    }
    case "backup": {
      const destination = args[0];
      if (!destination) throw new Error("Usage : tm-db backup <fichier de destination>");
      const { sqlite, close } = openDatabase(dbPath);
      await backupDatabase(sqlite, destination);
      close();
      log("db.backup", { destination });
      return;
    }
    case "integrity": {
      const file = args[0] ?? dbPath;
      if (!existsSync(file)) throw new Error(`Fichier introuvable : ${file}`);
      const { sqlite, close } = openDatabase(file, { readonly: true });
      const report = checkIntegrity(sqlite);
      close();
      log("db.integrity", { file, ...report });
      if (report.integrity !== "ok" || report.foreignKeyViolations > 0) process.exitCode = 1;
      return;
    }
    default:
      console.error("Commandes : migrate | seed [--demo] | backup <fichier> | integrity [fichier]");
      process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ level: "error", event: "db.cli.failed", message: (error as Error).message }));
  process.exitCode = 1;
});
