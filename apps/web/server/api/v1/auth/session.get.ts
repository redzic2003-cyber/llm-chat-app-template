import type { AuthSessionDTO } from "@tm/shared-types";
import { toUserDTO } from "../../../services/mappers";

export default defineApiHandler((event): AuthSessionDTO => {
  const auth = requireAuth(event);
  if (auth.kind === "web") {
    // Renouvelle la date d'expiration du cookie (expiration glissante).
    const presented = presentedToken(event);
    if (presented?.via === "cookie") setSessionCookie(event, presented.token, auth.expiresAt);
  }
  return { user: toUserDTO(auth.user), expiresAt: auth.expiresAt };
});
