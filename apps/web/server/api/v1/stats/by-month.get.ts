import { statsQuerySchema } from "@tm/schemas";
import { dashboardStats } from "../../../services/stats";

export default defineApiHandler((event) => {
  const stats = dashboardStats(useServiceContext(event), queryValidated(event, statsQuerySchema));
  return { period: stats.period, timezone: stats.timezone, byMonth: stats.byMonth };
});
