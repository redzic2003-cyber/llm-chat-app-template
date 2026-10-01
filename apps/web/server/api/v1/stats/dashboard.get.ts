import { statsQuerySchema } from "@tm/schemas";
import { dashboardStats } from "../../../services/stats";

/** Tous les indicateurs du dashboard en un seul appel (mêmes filtres pour tous les widgets). */
export default defineApiHandler((event) => dashboardStats(useServiceContext(event), queryValidated(event, statsQuerySchema)));
