import type { AppDatabase } from "@tm/database";
import type { Actor } from "../lib/permissions";

export interface ServiceConfig {
  timezone: string;
  qrGraceHours: number;
  reportsDir: string;
  pdfServiceUrl: string;
  appVersion: string;
  organization: string;
  webSessionTtlHours: number;
  mobileSessionTtlDays: number;
}

/** Tout ce dont un service a besoin : base, utilisateur courant, horloge, configuration. */
export interface ServiceContext {
  db: AppDatabase;
  actor: Actor;
  config: ServiceConfig;
  now?: () => Date;
}

export const currentTime = (ctx: Pick<ServiceContext, "now">): Date => (ctx.now ? ctx.now() : new Date());
