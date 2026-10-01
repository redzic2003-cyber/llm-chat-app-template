import { completeSession } from "../../../../services/sessions";

export default defineApiHandler((event) => completeSession(useServiceContext(event), routeParam(event, "id")));
