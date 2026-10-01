import { participantImportSchema } from "@tm/schemas";
import { importParticipants } from "../../../services/participants";

export default defineApiHandler(async (event) => {
  const ctx = useServiceContext(event);
  const { csv } = await readValidated(event, participantImportSchema);
  return importParticipants(ctx, csv);
});
