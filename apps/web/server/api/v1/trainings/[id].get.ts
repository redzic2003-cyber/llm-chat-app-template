import { getTraining } from "../../../services/trainings";

export default defineApiHandler((event) => getTraining(useServiceContext(event), routeParam(event, "id")));
