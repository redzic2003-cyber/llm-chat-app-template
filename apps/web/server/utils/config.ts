import type { ServiceConfig } from "../services/context";

export function useServiceConfig(): ServiceConfig {
  const config = useRuntimeConfig();
  return {
    timezone: config.public.timezone,
    qrGraceHours: Number(config.qrGraceHours),
    reportsDir: config.reportsDir,
    pdfServiceUrl: config.pdfServiceUrl,
    appVersion: config.public.appVersion,
    organization: config.organization,
    webSessionTtlHours: Number(config.webSessionTtlHours),
    mobileSessionTtlDays: Number(config.mobileSessionTtlDays),
  };
}
