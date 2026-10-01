import { reportCreateSchema } from "@tm/schemas";
import { enforce, limiters } from "../../../lib/rate-limit";
import { createReport } from "../../../services/reports";

export default defineApiHandler(async (event) => {
  const ctx = useServiceContext(event);
  enforce(limiters.reports, ctx.actor.id);
  const report = await createReport(ctx, await readValidated(event, reportCreateSchema));
  setResponseStatus(event, 201);
  return report;
});
