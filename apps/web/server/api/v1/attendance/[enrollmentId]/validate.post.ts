import { attendanceValidateSchema } from "@tm/schemas";
import { enforce, limiters } from "../../../../lib/rate-limit";
import { validateAttendance } from "../../../../services/attendance";

export default defineApiHandler(async (event) => {
  const ctx = useServiceContext(event);
  enforce(limiters.validate, ctx.actor.id);
  return validateAttendance(ctx, routeParam(event, "enrollmentId"), await readValidated(event, attendanceValidateSchema));
});
