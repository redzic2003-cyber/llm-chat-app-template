import { userUpdateSchema } from "@tm/schemas";
import { updateUser } from "../../../services/users";

export default defineApiHandler(async (event) => {
  const ctx = useServiceContext(event);
  return updateUser(ctx, routeParam(event, "id"), await readValidated(event, userUpdateSchema));
});
