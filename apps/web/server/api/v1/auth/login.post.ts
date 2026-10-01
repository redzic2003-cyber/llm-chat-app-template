import { loginSchema } from "@tm/schemas";
import type { LoginResponse } from "@tm/shared-types";
import { enforce, limiters } from "../../../lib/rate-limit";
import { login } from "../../../services/auth";

export default defineApiHandler(async (event): Promise<LoginResponse> => {
  const input = await readValidated(event, loginSchema);
  enforce(limiters.loginByIp, clientIp(event));
  enforce(limiters.loginByEmail, input.email);

  const result = await login(useDb(), useServiceConfig(), input, { previousToken: presentedToken(event)?.token });
  limiters.loginByEmail.reset(input.email);

  if (result.kind === "web") {
    setSessionCookie(event, result.token, result.expiresAt);
    return { user: result.user, expiresAt: result.expiresAt };
  }
  return { user: result.user, expiresAt: result.expiresAt, token: result.token };
});
