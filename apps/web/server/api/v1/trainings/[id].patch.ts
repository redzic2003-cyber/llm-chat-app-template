import { trainingUpdateSchema } from "@tm/schemas";
import { updateTraining } from "../../../services/trainings";

export default defineApiHandler(async (event) => {
  const ctx = useServiceContext(event);
  return updateTraining(ctx, routeParam(event, "id"), await readValidated(event, trainingUpdateSchema));
});
