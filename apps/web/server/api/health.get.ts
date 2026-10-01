import type { HealthResponse } from "@tm/shared-types";

/** Healthcheck (docs/blueprint/11-deployment.md) : base + service PDF. */
export default defineEventHandler(async (event): Promise<HealthResponse> => {
  const config = useRuntimeConfig();
  let database: HealthResponse["database"] = "ok";
  try {
    useDatabase().sqlite.prepare("SELECT 1").get();
  } catch {
    database = "error";
  }
  let pdfService: HealthResponse["pdfService"] = "unavailable";
  try {
    const res = await fetch(`${String(config.pdfServiceUrl).replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) pdfService = "ok";
  } catch {
    // indisponible
  }
  setHeader(event, "cache-control", "no-store");
  if (database !== "ok") setResponseStatus(event, 503);
  return {
    status: database === "ok" && pdfService === "ok" ? "ok" : "degraded",
    database,
    pdfService,
    version: config.public.appVersion,
  };
});
