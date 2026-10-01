import { listTrainers } from "../../../services/users";

export default defineApiHandler((event) => ({ items: listTrainers(useServiceContext(event)) }));
