import { issueQr } from "../../../../services/qr";

export default defineApiHandler((event) => {
  const issued = issueQr(useServiceContext(event), routeParam(event, "id"));
  setResponseStatus(event, 201);
  return issued;
});
