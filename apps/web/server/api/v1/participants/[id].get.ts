import { getParticipant } from "../../../services/participants";

export default defineApiHandler((event) => getParticipant(useServiceContext(event), routeParam(event, "id")));
