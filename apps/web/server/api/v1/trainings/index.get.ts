import { trainingsQuerySchema } from "@tm/schemas";
import { listTrainings } from "../../../services/trainings";

export default defineApiHandler((event) => ({
  items: listTrainings(useServiceContext(event), queryValidated(event, trainingsQuerySchema)),
}));
