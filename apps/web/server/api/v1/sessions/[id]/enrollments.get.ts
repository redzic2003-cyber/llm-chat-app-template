import { listEnrollments } from "../../../../services/enrollments";

export default defineApiHandler((event) => ({ items: listEnrollments(useServiceContext(event), routeParam(event, "id")) }));
