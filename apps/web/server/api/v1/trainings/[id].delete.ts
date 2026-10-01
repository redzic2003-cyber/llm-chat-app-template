import { deactivateTraining } from "../../../services/trainings";

/** Suppression logique (désactivation) : l'historique des sessions est conservé. */
export default defineApiHandler((event) => deactivateTraining(useServiceContext(event), routeParam(event, "id")));
