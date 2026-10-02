# chronoID · site vitrine

SvelteKit 3 + Svelte 5 + TypeScript + Tailwind CSS v4, déployé sur Cloudflare Workers.

## Commandes

```sh
npm install
npm run dev       # serveur de développement
npm run check     # typage (svelte-check)
npm run lint      # Prettier + ESLint
npm run build     # build de production (pages prérendues)
npm run preview   # aperçu du build avec Wrangler
npx wrangler deploy
```

## Organisation

- `src/routes/+page.svelte` : page d'accueil (maquette 5)
- `src/lib/components/` : sections de la page (Hero, Benefits, Sectors…)
- `src/lib/content.ts` : textes des secteurs et des produits
- `src/lib/assets/images/` : visuels, optimisés au build (AVIF/WebP) via `<enhanced:img>`
- `src/routes/layout.css` : couleurs et styles chronoID (`@theme`)
