import { participantsQuerySchema } from "@tm/schemas";
import { listParticipants } from "../../../services/participants";

export default defineApiHandler((event) => ({
  items: listParticipants(useServiceContext(event), queryValidated(event, participantsQuerySchema)),
}));
