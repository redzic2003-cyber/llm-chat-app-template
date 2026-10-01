import { readReportFile } from "../../../../services/reports";

export default defineApiHandler(async (event) => {
  const { report, data, filename } = await readReportFile(useServiceContext(event), routeParam(event, "id"));
  setHeaders(event, {
    "content-type": "application/pdf",
    "content-length": data.length,
    "content-disposition": `${getQuery(event).inline ? "inline" : "attachment"}; filename="${filename}"`,
    "x-content-sha256": report.sha256,
  });
  return data;
});
