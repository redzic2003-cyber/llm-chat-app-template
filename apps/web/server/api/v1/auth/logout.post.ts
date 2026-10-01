import { logout } from "../../../services/auth";

export default defineApiHandler((event) => {
  const auth = getAuth(event);
  if (auth) logout(useDb(), auth);
  clearSessionCookie(event);
  return { ok: true as const };
});
