import { enrollmentsAddSchema } from "@tm/schemas";
import { addEnrollments } from "../../../../services/enrollments";

export default defineApiHandler(async (event) => {
  const ctx = useServiceContext(event);
  const { participantIds } = await readValidated(event, enrollmentsAddSchema);
  const items = addEnrollments(ctx, routeParam(event, "id"), participantIds);
  setResponseStatus(event, 201);
  return { items };
});
