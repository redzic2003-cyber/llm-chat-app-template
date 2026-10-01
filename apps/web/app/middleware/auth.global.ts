/** Toutes les pages exigent une session, sauf /login. */
export default defineNuxtRouteMiddleware(async (to) => {
  const { user, refresh } = useAuth();
  if (user.value === null) await refresh();
  if (to.path === "/login") {
    if (user.value) return navigateTo(typeof to.query.redirect === "string" && to.query.redirect.startsWith("/") ? to.query.redirect : "/");
    return;
  }
  if (!user.value) return navigateTo({ path: "/login", query: to.fullPath !== "/" ? { redirect: to.fullPath } : {} });
  const required = to.meta.permission as Parameters<ReturnType<typeof useAuth>["can"]>[0] | undefined;
  if (required && !useAuth().can(required)) return navigateTo("/");
});
