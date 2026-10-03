# Livoti Formations

Application interne pour gérer des formations, leurs participants, la validation de présence par QR code, les statistiques et les rapports PDF.

Implémentation du blueprint fourni (`docs/blueprint/`). Le parcours principal est le suivant :

1. créer une formation ;
2. planifier une session dans le calendrier ;
3. inscrire des participants ;
4. imprimer un QR individuel par participant et par session ;
5. scanner le QR avec l'app mobile du formateur ;
6. confirmer la présence ;
7. consulter les statistiques ;
8. générer un rapport PDF (semaine, mois, année, période libre, session ou participant).

## Composants

| Composant | Dossier | Technologie |
|---|---|---|
| Web + API | `apps/web` | Nuxt 4 (Vue 3, TypeScript), routes serveur `/api/v1`, FullCalendar, ECharts |
| Mobile formateur | `apps/mobile` | Vue 3 + Capacitor 8, ML Kit (scan natif), haptique, stockage sécurisé |
| Base de données | `database` | SQLite (WAL) + Drizzle ORM + better-sqlite3, migrations, seeds, CLI d'exploitation |
| Service PDF | `services/pdf` | Rust, axum, Krilla + krilla-svg (graphiques SVG vectoriels), police embarquée |
| Paquets partagés | `packages/*` | `shared-types`, `schemas` (Zod), `qr-core`, `analytics`, `api-client` |
| Exploitation | `ops/` | nginx, systemd, sauvegardes chiffrées, test de restauration, déploiement |

```text
Vue/Nuxt web ──HTTPS──▶ API Nuxt (auth, RBAC, CRUD, QR, stats) ──▶ SQLite (WAL)
Vue + Capacitor ──HTTPS──▶        │
                                  └──JSON interne──▶ Rust + Krilla (127.0.0.1:8090) ──▶ PDF
```

## Démarrage rapide (développement)

Prérequis : Node 22+, pnpm 10, Rust 1.92+ (pour le service PDF).

```bash
pnpm install

# Base locale (data/app.sqlite3) : administrateur + jeu de démonstration
SEED_ADMIN_EMAIL=admin@example.ch SEED_ADMIN_PASSWORD=admin-formation-2026 pnpm db:seed:demo

pnpm pdf:dev        # terminal 1 : service PDF sur 127.0.0.1:8090
pnpm dev            # terminal 2 : web + API sur http://localhost:3000
pnpm dev:mobile     # terminal 3 (facultatif) : app mobile dans le navigateur, http://localhost:5173
```

Comptes de démonstration (mot de passe `demo-formation-2026`, modifiable via `SEED_DEMO_PASSWORD`) :

| Compte | Rôle |
|---|---|
| `admin@example.ch` (mot de passe du seed) | administrateur |
| `formateur@example.ch`, `formateur2@example.ch` | formateur |
| `direction@example.ch` | lecture seule |

Dans le navigateur, l'app mobile utilise la caméra avec jsQR. Elle propose aussi un champ de saisie du contenu `TRN1:…` pour tester sans caméra. Pour obtenir des QR, ouvrez une session dans le web, puis « Générer les QR ».

## Commandes

| Commande | Effet |
|---|---|
| `pnpm test` | tests Vitest : paquets, base, services de l'API |
| `pnpm typecheck` | vérification TypeScript de tout le monorepo (dont `nuxt typecheck` et `vue-tsc`) |
| `pnpm build` | build de production web (`apps/web/.output`) et mobile (`apps/mobile/dist`) |
| `pnpm db:generate` | génère une migration Drizzle après modification de `database/schema/schema.ts` |
| `pnpm db:migrate` | applique les migrations |
| `pnpm db:seed` / `pnpm db:seed:demo` | crée l'administrateur, et en option les données de démo |
| `pnpm db:backup <fichier>` / `pnpm db:integrity [fichier]` | sauvegarde cohérente et contrôle d'intégrité (sans `sqlite3`) |
| `pnpm pdf:build` | binaire release du service PDF |
| `cargo test`, `cargo clippy` | dans `services/pdf` |

## Sécurité : choix appliqués

- **QR** : contient uniquement `TRN1:<token>`. Le token fait 32 octets aléatoires (CSPRNG), encodés en Base64URL. En base, seul `SHA-256(token)` est stocké. Le token brut n'est affiché qu'une fois, à l'impression ; une réimpression passe par une rotation qui révoque l'ancien QR. Le QR ne contient aucune donnée personnelle, aucune URL et aucun identifiant prévisible.
- **Scan en deux temps** : `POST /scans/resolve` renvoie un aperçu sans rien modifier. `POST /attendance/:id/validate` valide dans une transaction SQLite, avec une clé d'idempotence. Un index unique partiel garantit au niveau de la base « une présence active maximum par inscription ».
- **Chaque scan est journalisé** (utilisateur, appareil, résultat), jamais avec le token.
- **Authentification** : mots de passe hachés avec scrypt. Les sessions sont opaques et stockées sous forme de hash. Côté web, cookie `__Host-` en HttpOnly, Secure et SameSite=Strict, avec contrôle d'origine contre le CSRF. Côté mobile, jeton Bearer dans le Keychain ou le Keystore. Le jeton change à chaque connexion et l'expiration est glissante.
- **Droits** : l'administrateur peut tout faire. Le formateur gère ses propres sessions (inscriptions, QR, scan, validation, clôture) et génère des rapports. Le compte lecture seule voit les données et les statistiques.
- **Protections HTTP** : validation Zod de tous les payloads, limitation de débit (login, scan, validation, rapports), CSP stricte par empreintes SHA-256, en-têtes de sécurité, CORS limité aux origines Capacitor, limite de taille des requêtes.
- **Rapports PDF** : écrits sur disque en `0600`. Leur SHA-256 est stocké en base et vérifié à chaque téléchargement.
- **Base de données** : fichier en `0600` dans un dossier `0700`. Sauvegardes `.backup` vérifiées, compressées (zstd), chiffrées (age) et copiées hors machine.
- **Logs** : JSON structurés, sans mot de passe, cookie, jeton ni token QR.

## Déploiement (petit VPS Linux)

Arborescence : `/opt/training-manager/{app,pdf-service}`, `/var/lib/training-manager/{db,reports}`, `/var/backups/training-manager`.

1. Créer les utilisateurs système `training-manager` et `training-pdf`, et les dossiers ci-dessus (`0700`).
2. Cloner le dépôt dans `/opt/training-manager/app`.
3. Copier `.env.example` vers `/etc/training-manager/web.env` (`0600`) et l'adapter. Copier `ops/backup/backup.env.example` vers `/etc/training-manager/backup.env`.
4. Installer `ops/systemd/*` dans `/etc/systemd/system/`, puis activer `training-pdf`, `training-web` et `training-backup.timer`.
5. Installer `ops/nginx/training-manager.conf` et `ops/nginx/training-proxy.conf` (snippet), puis obtenir le certificat TLS.
6. Créer l'administrateur avec `SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… pnpm db:seed`.
7. Déployer avec `ops/deploy/deploy.sh <tag>`. Le script enchaîne tests → build Nuxt → build Rust → **sauvegarde → migration** → redémarrage → healthcheck (`GET /api/health`).
8. Chaque trimestre, lancer le test de restauration : `ops/backup/restore-test.sh <archive.age> <clé-age>`. Il déchiffre l'archive, vérifie les empreintes, lance `integrity_check`, démarre l'application sur la copie et consigne la date.

## Application mobile

```bash
cd apps/mobile
cp .env.example .env            # VITE_API_BASE_URL=https://formations.example.ch
pnpm build && npx cap add android && npx cap add ios   # une seule fois
pnpm cap:sync && pnpm cap:android                       # ou cap:ios
```

Les dossiers `android/` et `ios/` sont générés localement et ne sont pas versionnés. L'origine Capacitor (`https://localhost` sur Android, `capacitor://localhost` sur iOS) doit figurer dans `NUXT_CORS_ORIGINS`.

Fonctionnalités : connexion, sessions du jour (navigation par jour), détail d'une session avec liste en direct, scanner ML Kit natif, écran de confirmation, résultat avec vibration et son, retour automatique au scanner. Messages d'erreur explicites : QR INCONNU, QR RÉVOQUÉ, MAUVAISE SESSION, DÉJÀ VALIDÉ, QR EXPIRÉ, SESSION CLÔTURÉE… Validation manuelle si le QR est oublié. Mode « validation rapide » : un seul toucher sur la fiche, l'identité restant toujours affichée. Les validations dont l'envoi échoue faute de réseau sont mises en file et renvoyées automatiquement (sans doublon grâce à la clé d'idempotence).

## API

Préfixe `/api/v1`, erreurs au format uniforme `{ "error": { "code", "message", "details? } }` (cf. `docs/blueprint/07-api-contract.md`). Routes ajoutées au contrat initial :

- `GET /stats/dashboard` : tous les indicateurs en un appel, avec les mêmes filtres (`from`, `to`, `trainingId`, `trainerId`, `department`) ;
- `POST /sessions/:id/qr` : émission groupée pour l'impression (`missing` ou `all`) ;
- `GET /sessions/:id/export` : liste d'émargement en CSV ;
- `PATCH /sessions/:id/enrollments/:enrollmentId` : excusé ou absent ;
- `POST /auth/password` ;
- `GET|POST /users`, `PATCH /users/:id`, `GET /users/trainers` ;
- `GET /audit`.

## Écarts et compléments par rapport au blueprint

- **Schéma** (`database/schema/schema.ts`) : ajouts de `users.password_hash`, de la table `auth_sessions` et, pour l'historique des validations, des colonnes `idempotency_key`, `revoked_at`, `revoked_by` et `revoke_reason`. Index uniques partiels : une présence active et un QR actif au maximum par inscription. Colonnes `title`, `size_bytes` et `params_json` sur `reports`.
- **Statistiques** : filtrage en SQL, puis agrégation en TypeScript (`@tm/analytics`) dans le fuseau d'affichage (Europe/Zurich par défaut). Une session à 00:30 locale compte ainsi le bon jour, la bonne semaine ISO et le bon mois. Les définitions retenues sont documentées dans `packages/analytics/src/stats.ts`.
- **Clôture d'une session** : les inscrits non validés passent « absents ». Une **annulation** révoque les QR émis. Après clôture, seul un administrateur peut corriger une présence, et uniquement en saisie manuelle.
- **Service PDF** : police Liberation Sans (licence OFL) embarquée. Les graphiques sont générés en SVG puis insérés vectoriellement. Les métadonnées PDF (titre, auteur, date de création, période, version) sont renseignées.

## Reste à faire (V2 selon `docs/blueprint/12-roadmap.md`)

- Mode hors ligne complet (« session pack »). Seule la file de renvoi des validations existe aujourd'hui.
- Passkeys / TOTP, multi-sites, notifications, attestations, signature de l'apprenant, export Excel.
- Limitation de débit en mémoire, prévue pour une instance unique. Le reverse proxy ajoute la sienne.

L'état détaillé par rapport à la checklist MVP se trouve dans [`docs/implementation-status.md`](docs/implementation-status.md).
