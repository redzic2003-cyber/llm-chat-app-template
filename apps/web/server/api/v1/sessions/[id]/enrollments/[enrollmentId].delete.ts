import { removeEnrollment } from "../../../../../services/enrollments";

export default defineApiHandler((event) => {
  removeEnrollment(useServiceContext(event), routeParam(event, "id"), routeParam(event, "enrollmentId"));
  return { ok: true as const };
});
