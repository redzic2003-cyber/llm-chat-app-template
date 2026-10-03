import { cpSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const migrationsDir = resolve(repoRoot, "database/migrations");
const appVersion = process.env.APP_VERSION ?? "0.1.0";

// Paquets du monorepo distribués en TypeScript source : Nitro doit les inclure dans le bundle.
const workspacePackages = [
  "@tm/analytics",
  "@tm/api-client",
  "@tm/database",
  "@tm/qr-core",
  "@tm/schemas",
  "@tm/shared-types",
];

export default defineNuxtConfig({
  compatibilityDate: "2026-09-01",
  devtools: { enabled: false },
  // Outil interne : rendu côté client, l'API reste l'autorité (aucune donnée dans le HTML).
  ssr: false,
  telemetry: false,

  app: {
    head: {
      htmlAttrs: { lang: "fr" },
      title: "Livoti Formations",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "robots", content: "noindex, nofollow" },
      ],
      link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    },
  },

  css: ["~/assets/css/main.css"],

  runtimeConfig: {
    // Surchargeables à l'exécution via NUXT_<NOM> (ex. NUXT_DATABASE_PATH).
    databasePath: resolve(repoRoot, "data/app.sqlite3"),
    migrationsDir,
    autoMigrate: true,
    reportsDir: resolve(repoRoot, "data/reports"),
    pdfServiceUrl: "http://127.0.0.1:8090",
    /** Origines autorisées (CORS) pour l'app mobile, séparées par des virgules. */
    corsOrigins: "capacitor://localhost,https://localhost,http://localhost:5173",
    /** Cookie `Secure` : à laisser actif derrière HTTPS ; désactivable uniquement en local. */
    cookieSecure: process.env.NODE_ENV === "production",
    /** Faire confiance à X-Forwarded-For (uniquement derrière le reverse proxy). */
    trustProxy: false,
    webSessionTtlHours: 12,
    mobileSessionTtlDays: 30,
    /** Durée de validité d'un QR après la fin de la session. */
    qrGraceHours: 24,
    organization: "",
    public: {
      appName: "Livoti Formations",
      appVersion,
      timezone: "Europe/Zurich",
    },
  },

  build: {
    transpile: workspacePackages,
  },

  vite: {
    optimizeDeps: {
      include: ["echarts", "vue-echarts", "qrcode", "@fullcalendar/core", "@fullcalendar/vue3"],
    },
  },

  nitro: {
    externals: {
      inline: workspacePackages,
    },
    hooks: {
      // Livre les migrations avec le build : .output/server/migrations
      compiled(nitro) {
        const target = join(nitro.options.output.serverDir, "migrations");
        if (existsSync(migrationsDir)) cpSync(migrationsDir, target, { recursive: true });
      },
    },
  },

  typescript: {
    strict: true,
  },
});
