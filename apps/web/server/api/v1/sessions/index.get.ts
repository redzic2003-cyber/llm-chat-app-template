import { sessionsQuerySchema } from "@tm/schemas";
import { listSessions } from "../../../services/sessions";

export default defineApiHandler((event) => ({
  items: listSessions(useServiceContext(event), queryValidated(event, sessionsQuerySchema)),
}));
