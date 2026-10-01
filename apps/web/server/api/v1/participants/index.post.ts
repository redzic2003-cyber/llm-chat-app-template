import { participantCreateSchema } from "@tm/schemas";
import { createParticipant } from "../../../services/participants";

export default defineApiHandler(async (event) => {
  const ctx = useServiceContext(event);
  const participant = createParticipant(ctx, await readValidated(event, participantCreateSchema));
  setResponseStatus(event, 201);
  return participant;
});
