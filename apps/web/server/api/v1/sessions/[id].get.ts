import { getSession } from "../../../services/sessions";

export default defineApiHandler((event) => getSession(useServiceContext(event), routeParam(event, "id")));
