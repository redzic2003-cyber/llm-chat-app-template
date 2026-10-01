/** Ouvre la base (et applique les migrations) au démarrage plutôt qu'à la première requête. */
export default defineNitroPlugin((nitro) => {
  useDatabase();
  nitro.hooks.hookOnce("close", () => closeDatabase());
});
