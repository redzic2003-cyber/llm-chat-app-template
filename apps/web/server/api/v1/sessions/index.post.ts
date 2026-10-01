import { sessionCreateSchema } from "@tm/schemas";
import { createSession } from "../../../services/sessions";

export default defineApiHandler(async (event) => {
  const ctx = useServiceContext(event);
  const session = createSession(ctx, await readValidated(event, sessionCreateSchema));
  setResponseStatus(event, 201);
  return session;
});
