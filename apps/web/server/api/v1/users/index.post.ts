import { userCreateSchema } from "@tm/schemas";
import { createUser } from "../../../services/users";

export default defineApiHandler(async (event) => {
  const ctx = useServiceContext(event);
  const user = await createUser(ctx, await readValidated(event, userCreateSchema));
  setResponseStatus(event, 201);
  return user;
});
