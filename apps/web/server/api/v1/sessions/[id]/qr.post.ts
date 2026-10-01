import { qrBatchSchema } from "@tm/schemas";
import { issueQrBatch } from "../../../../services/qr";

/** Émission groupée des QR d'une session (impression des fiches). */
export default defineApiHandler(async (event) => {
  const ctx = useServiceContext(event);
  const { mode } = await readValidated(event, qrBatchSchema);
  return { items: issueQrBatch(ctx, routeParam(event, "id"), mode) };
});
