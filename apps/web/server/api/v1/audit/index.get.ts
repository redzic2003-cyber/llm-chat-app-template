import { auditQuerySchema } from "@tm/schemas";
import { listAudit } from "../../../services/audit";

export default defineApiHandler((event) => ({
  items: listAudit(useServiceContext(event), queryValidated(event, auditQuerySchema)),
}));
