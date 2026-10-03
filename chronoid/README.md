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

## Formulaire de contact

Page `/contact` (et `/de/contact`, `/it/contact`, `/en/contact`), traitée côté serveur par le Worker.

- Validation avec Valibot (`src/lib/server/contact.ts`), messages d'erreur traduits.
- Anti-spam : Cloudflare Turnstile + champ piège invisible.
- Envoi par email via l'API Resend, avec l'adresse du visiteur en « répondre à ».
- En local (`npm run dev`) sans clé Resend, l'email est affiché dans le terminal au lieu d'être envoyé.

Variables (déclarées dans `src/env.ts`) :

| Variable                    | Type   | Rôle                                           |
| --------------------------- | ------ | ---------------------------------------------- |
| `RESEND_API_KEY`            | secret | Clé API Resend                                 |
| `TURNSTILE_SECRET_KEY`      | secret | Clé secrète Turnstile                          |
| `PUBLIC_TURNSTILE_SITE_KEY` | public | Clé publique Turnstile (affiche le widget)     |
| `CONTACT_TO_EMAIL`          | public | Destinataire des demandes (défaut : contact@…) |
| `CONTACT_FROM_EMAIL`        | public | Expéditeur, sur un domaine vérifié dans Resend |

Pour tester avec Wrangler : `cp .dev.vars.example .dev.vars`, puis `npm run build && npm run preview`.

## Déploiement sur Cloudflare

1. **Resend** : créer un compte, vérifier le domaine d'envoi (enregistrements DNS), créer une clé API.
2. **Turnstile** : dans le tableau de bord Cloudflare, créer un widget pour le domaine du site.
3. **Secrets** (une seule fois) :
   ```sh
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put TURNSTILE_SECRET_KEY
   ```
4. **Variables non secrètes** : les ajouter dans `wrangler.jsonc` sous `"vars"` (`PUBLIC_TURNSTILE_SITE_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`).
5. **Déployer** : `npm run build && npx wrangler deploy`, ou connecter le dépôt GitHub dans
   Cloudflare (Workers Builds, dossier racine `chronoid`) pour déployer à chaque push.
