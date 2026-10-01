import { trainingCreateSchema } from "@tm/schemas";
import { createTraining } from "../../../services/trainings";

export default defineApiHandler(async (event) => {
  const ctx = useServiceContext(event);
  const training = createTraining(ctx, await readValidated(event, trainingCreateSchema));
  setResponseStatus(event, 201);
  return training;
});
