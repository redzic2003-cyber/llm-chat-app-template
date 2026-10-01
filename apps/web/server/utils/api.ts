import type { EventHandlerRequest, H3Event } from "h3";
import type { ZodType } from "zod";
import { errorBody, toApiError } from "../lib/errors";

/**
 * Enveloppe des routes API : erreurs au format uniforme `{ error: { code, message } }`.
 */
export function defineApiHandler<T>(handler: (event: H3Event<EventHandlerRequest>) => T | Promise<T>) {
  return defineEventHandler(async (event) => {
    try {
      return await handler(event);
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.status >= 500) {
        log("error", "api.error", {
          path: event.path.split("?")[0],
          method: event.method,
          code: apiError.code,
          message: (error as Error)?.message,
          stack: (error as Error)?.stack?.split("\n").slice(0, 6).join(" | "),
        });
      }
      const retryAfter = (apiError.details as { retryAfter?: number } | undefined)?.retryAfter;
      if (apiError.code === "RATE_LIMITED" && retryAfter) setHeader(event, "retry-after", retryAfter);
      setResponseStatus(event, apiError.status);
      return errorBody(apiError);
    }
  });
}

export async function readValidated<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  const body = await readBody(event).catch(() => {
    throw createError({ statusCode: 400, statusMessage: "Corps JSON invalide." });
  });
  return schema.parse(body ?? {});
}

export function queryValidated<T>(event: H3Event, schema: ZodType<T>): T {
  return schema.parse(getQuery(event));
}

export function routeParam(event: H3Event, name: string): string {
  const value = getRouterParam(event, name, { decode: true });
  if (!value || value.length > 64) throw createError({ statusCode: 404, statusMessage: "Ressource introuvable." });
  return value;
}
