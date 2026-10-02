# chronoID · site vitrine

SvelteKit 3 + Svelte 5 + TypeScript + Tailwind CSS v4 + Paraglide JS (i18n), déployé sur Cloudflare Workers.

## Commandes

```sh
npm install
npm run dev       # serveur de développement
npm run check     # compile les traductions puis vérifie le typage
npm run lint      # Prettier + ESLint
npm run build     # build de production (pages prérendues)
npm run preview   # aperçu du build avec Wrangler
npx wrangler deploy
npm run gen       # régénère les types Cloudflare après un changement de wrangler.jsonc (avant le build)
```

## Organisation

- `src/routes/+page.svelte` : page d'accueil (maquette 5)
- `src/lib/components/` : sections de la page (Hero, Benefits, Sectors…)
- `src/lib/content.ts` : textes des secteurs et des produits
- `src/lib/assets/images/` : visuels, optimisés au build (AVIF/WebP) via `<enhanced:img>`
- `src/routes/layout.css` : couleurs et styles chronoID (`@theme`)

## Langues

Quatre langues, une page prérendue par langue : `/` (français, par défaut), `/de`, `/it`, `/en`.

- Les textes sont dans `messages/{fr,de,it,en}.json`, avec les mêmes clés dans chaque fichier.
- Dans un composant : `import { m } from '#lib/paraglide/messages.js'`, puis `{m.hero_title()}`.
- Ajouter une langue : l'ajouter dans `project.inlang/settings.json`, créer `messages/<code>.json`
  et compléter `localeNames` dans `src/lib/site.ts`.
- Les balises `hreflang` et `canonical` utilisent `SITE_URL` (`src/lib/site.ts`) : à remplacer par le vrai domaine.

## Police

Neue Haas Unica (Monotype, licence web payante). Les fichiers ne sont pas dans le dépôt :
déposez les `.woff2` dans `src/lib/assets/fonts/` (noms dans le README de ce dossier) et rebuildez.
En attendant, le site s'affiche en Inter.
