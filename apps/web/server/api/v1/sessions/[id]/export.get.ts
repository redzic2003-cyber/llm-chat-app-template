import { exportSessionCsv } from "../../../../services/enrollments";

export default defineApiHandler((event) => {
  const { filename, content } = exportSessionCsv(useServiceContext(event), routeParam(event, "id"));
  setHeaders(event, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${filename}"`,
  });
  return content;
});
