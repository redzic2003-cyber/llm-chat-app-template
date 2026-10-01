import { participantUpdateSchema } from "@tm/schemas";
import { updateParticipant } from "../../../services/participants";

export default defineApiHandler(async (event) => {
  const ctx = useServiceContext(event);
  return updateParticipant(ctx, routeParam(event, "id"), await readValidated(event, participantUpdateSchema));
});
