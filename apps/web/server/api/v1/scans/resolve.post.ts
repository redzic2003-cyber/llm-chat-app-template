import { scanResolveSchema } from "@tm/schemas";
import { enforce, limiters } from "../../../lib/rate-limit";
import { resolveScan } from "../../../services/qr";

export default defineApiHandler(async (event) => {
  const ctx = useServiceContext(event);
  enforce(limiters.scan, ctx.actor.id);
  return resolveScan(ctx, await readValidated(event, scanResolveSchema));
});
