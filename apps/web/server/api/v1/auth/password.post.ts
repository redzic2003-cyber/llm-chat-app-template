import { passwordChangeSchema } from "@tm/schemas";
import { enforce, limiters } from "../../../lib/rate-limit";
import { changeOwnPassword } from "../../../services/auth";

export default defineApiHandler(async (event) => {
  const auth = requireAuth(event);
  const input = await readValidated(event, passwordChangeSchema);
  enforce(limiters.loginByEmail, auth.user.email);
  await changeOwnPassword(useServiceContext(event), auth.sessionId, input);
  return { ok: true as const };
});
