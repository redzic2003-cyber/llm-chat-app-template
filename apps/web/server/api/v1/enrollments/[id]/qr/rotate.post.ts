import { rotateQr } from "../../../../../services/qr";

export default defineApiHandler((event) => rotateQr(useServiceContext(event), routeParam(event, "id")));
