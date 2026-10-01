import { attendanceRevokeSchema } from "@tm/schemas";
import { revokeAttendance } from "../../../../services/attendance";

export default defineApiHandler(async (event) => {
  const ctx = useServiceContext(event);
  const { reason } = await readValidated(event, attendanceRevokeSchema);
  return revokeAttendance(ctx, routeParam(event, "enrollmentId"), reason);
});
