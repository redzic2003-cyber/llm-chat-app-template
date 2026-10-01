import { sessionUpdateSchema } from "@tm/schemas";
import { updateSession } from "../../../services/sessions";

export default defineApiHandler(async (event) => {
  const ctx = useServiceContext(event);
  return updateSession(ctx, routeParam(event, "id"), await readValidated(event, sessionUpdateSchema));
});
