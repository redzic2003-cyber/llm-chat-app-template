import { sessionCancelSchema } from "@tm/schemas";
import { cancelSession } from "../../../../services/sessions";

export default defineApiHandler(async (event) => {
  const ctx = useServiceContext(event);
  const { reason } = await readValidated(event, sessionCancelSchema);
  return cancelSession(ctx, routeParam(event, "id"), reason);
});
