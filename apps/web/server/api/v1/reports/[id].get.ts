import { getReport } from "../../../services/reports";

export default defineApiHandler((event) => getReport(useServiceContext(event), routeParam(event, "id")));
