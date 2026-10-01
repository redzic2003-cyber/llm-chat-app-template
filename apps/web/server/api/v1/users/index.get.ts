import { usersQuerySchema } from "@tm/schemas";
import { listUsers } from "../../../services/users";

export default defineApiHandler((event) => ({
  items: listUsers(useServiceContext(event), queryValidated(event, usersQuerySchema)),
}));
