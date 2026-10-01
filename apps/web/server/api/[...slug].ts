import { ApiError } from "../lib/errors";

/** Toute route /api inconnue renvoie le format d'erreur uniforme (et non la page SPA). */
export default defineApiHandler(() => {
  throw new ApiError("NOT_FOUND", "Route inconnue.");
});
