import { enrollmentUpdateSchema } from "@tm/schemas";
import { setEnrollmentStatus } from "../../../../../services/enrollments";

export default defineApiHandler(async (event) => {
  const ctx = useServiceContext(event);
  const { status } = await readValidated(event, enrollmentUpdateSchema);
  return setEnrollmentStatus(ctx, routeParam(event, "id"), routeParam(event, "enrollmentId"), status);
});
