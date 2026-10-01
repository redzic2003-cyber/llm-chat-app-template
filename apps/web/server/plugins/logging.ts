/** Journal d'accès structuré : méthode, chemin (sans query string), statut, durée, utilisateur. */
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook("request", (event) => {
    event.context.startedAt = performance.now();
  });
  nitro.hooks.hook("afterResponse", (event) => {
    const path = event.path.split("?")[0] ?? "";
    if (!path.startsWith("/api/")) return;
    log("info", "http.request", {
      method: event.method,
      path,
      status: getResponseStatus(event),
      ms: Math.round((performance.now() - ((event.context.startedAt as number) ?? performance.now())) * 10) / 10,
      userId: event.context.userId ?? null,
    });
  });
});
