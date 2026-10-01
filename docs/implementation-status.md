# État d'implémentation — checklist MVP

Reprise de `docs/blueprint/13-mvp-checklist.md` avec, pour chaque point, l'emplacement de l'implémentation et sa vérification. Légende : ✅ fait et testé · 🟡 fait, à valider en conditions réelles · ⬜ à faire côté exploitation.

## Base

| Point | État | Où / comment |
|---|---|---|
| SQLite créé | ✅ | `database/src/client.ts` (fichier 0600, dossier 0700) |
| WAL activé | ✅ | `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON`, `busy_timeout=5000` |
| migrations | ✅ | `database/migrations` (Drizzle), `pnpm db:migrate`, livrées dans `.output/server/migrations` |
| seed admin | ✅ | `pnpm db:seed` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`) |
| sauvegarde automatique | ✅ | `ops/backup/backup.sh` + `training-backup.timer`, testé : rotation 7/4/12, chiffrement age |

## Auth

| Point | État | Où / comment |
|---|---|---|
| login / logout / session | ✅ | `/api/v1/auth/*`, cookie `__Host-` (web) ou Bearer (mobile) |
| admin / trainer / viewer | ✅ | `apps/web/server/lib/permissions.ts` |
| permissions testées | ✅ | `apps/web/tests/attendance-flow.test.ts` (« applique les droits par rôle ») |

## Formations, participants, sessions

| Point | État | Où / comment |
|---|---|---|
| Formations : créer, modifier, désactiver, référence unique | ✅ | page `/trainings`, service `trainings.ts` |
| Participants : créer, modifier, rechercher, désactiver | ✅ | page `/participants` (recherche instantanée, sans accents), import CSV |
| Sessions : calendrier, création, horaire, formateur, lieu, participants, statut | ✅ | page `/calendar` (FullCalendar), `/sessions/:id` |

## QR

| Point | État | Où / comment |
|---|---|---|
| token 256 bits, Base64URL | ✅ | `packages/qr-core` (tests d'entropie et de format) |
| SHA-256 côté serveur, aucune donnée personnelle | ✅ | test « émet des QR sans donnée personnelle… » |
| rotation, révocation | ✅ | `/enrollments/:id/qr/rotate`, révocation à l'annulation de la session |
| scan resolve, confirmation validate | ✅ | `/scans/resolve`, `/attendance/:id/validate` |
| double validation gérée | ✅ | index unique partiel + `ATTENDANCE_ALREADY_VALIDATED` + idempotence |

## Mobile

| Point | État | Où / comment |
|---|---|---|
| login, sessions du jour, scan, affichage participant, validation, erreurs explicites | ✅ | testé de bout en bout dans Chromium (viewport mobile) contre l'API |
| caméra / scan natif, vibration | 🟡 | ML Kit + Haptics Capacitor : à valider sur un appareil (`npx cap add android`) |

## Statistiques

| Point | État | Où / comment |
|---|---|---|
| jour, semaine, mois, année | ✅ | `@tm/analytics` (semaines ISO, fuseau horaire, DST testés) |
| participants, uniques, heures formation, heures-participants, taux de présence | ✅ | `computeSummary` + dashboard |

## PDF

| Point | État | Où / comment |
|---|---|---|
| service Rust, Krilla | ✅ | `services/pdf` (`cargo test` : rendu de `sample-report.json`, pagination, API HTTP) |
| rapport session, rapport mensuel (et hebdo, annuel, libre, participant) | ✅ | `services/pdf/src/render.rs` |
| graphiques SVG | ✅ | `services/pdf/src/charts.rs` (insertion vectorielle via krilla-svg) |
| checksum | ✅ | SHA-256 stocké en base, vérifié au téléchargement (`X-Content-SHA256`) |

## Production

| Point | État | Où / comment |
|---|---|---|
| HTTPS | ⬜ | `ops/nginx/training-manager.conf` (certificat à obtenir) |
| rate limit | ✅ | applicatif (login, scan, validation, rapports) + nginx |
| CSP | ✅ | `apps/web/server/plugins/csp.ts` (empreintes SHA-256 des scripts inline) |
| logs structurés | ✅ | JSON (Nuxt et service PDF), sans secret |
| backup hors machine | ⬜ | renseigner `BACKUP_REMOTE` (rsync ou rclone) |
| restauration testée | ✅ | `ops/backup/restore-test.sh`, exécuté avec succès sur une sauvegarde réelle |
| healthcheck | ✅ | `GET /api/health` (base + service PDF) |
