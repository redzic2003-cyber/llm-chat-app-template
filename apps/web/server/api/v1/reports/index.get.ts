import { listReports } from "../../../services/reports";

export default defineApiHandler((event) => ({ items: listReports(useServiceContext(event)) }));
