# Training Manager — Blueprint complet

Application interne minimaliste pour gérer des formations, leurs participants, la validation de présence par QR code, les statistiques et les exports PDF.

## Objectif

Le système doit rester simple :

1. créer un type de formation ;
2. planifier une session dans un calendrier ;
3. ajouter des participants ;
4. générer un QR individuel par participant et par session ;
5. scanner le QR depuis l'application du formateur ;
6. confirmer la présence ;
7. obtenir immédiatement les statistiques ;
8. générer un rapport PDF hebdomadaire, mensuel, annuel ou sur période libre.

## Stack recommandée

- **Web** : Vue 3 + TypeScript + Nuxt
- **UI** : CSS natif + composants internes simples
- **Calendrier** : FullCalendar
- **Graphiques** : Apache ECharts
- **API** : routes serveur Nuxt
- **Validation** : Zod
- **ORM** : Drizzle ORM
- **Base de données** : SQLite
- **Driver SQLite** : better-sqlite3
- **Mobile** : Vue 3 + TypeScript + Capacitor
- **Scanner QR** : plugin caméra/QR Capacitor
- **PDF** : service Rust séparé + Krilla
- **Déploiement** : 1 petit VPS Linux + reverse proxy HTTPS
- **Sauvegardes** : copie SQLite automatisée + chiffrement + rétention

## Pourquoi SQLite suffit

Pour cette application, SQLite est un excellent choix si :

- il y a peu d'utilisateurs simultanés ;
- l'application tourne sur un seul serveur ;
- le volume reste de quelques milliers ou dizaines de milliers de formations/présences ;
- les écritures sont courtes et transactionnelles ;
- on active le mode WAL ;
- les sauvegardes sont correctement gérées.

Le modèle métier est relationnel mais petit. On ne stocke pas de gros fichiers dans SQLite : uniquement des références, dates, noms, statuts, hashes QR et métadonnées.

Une migration PostgreSQL ne devient utile que si l'application évolue vers plusieurs sites, de nombreux formateurs connectés en même temps, plusieurs instances serveur, de fortes écritures concurrentes ou un SaaS multi-tenant.

## Principe central

Le QR **ne contient ni URL publique, ni nom, ni prénom, ni référence sensible**.

Exemple :

```text
TRN1:Q5aFQAOY7T9hQmO7yV... 
```

La partie après `TRN1:` est un token aléatoire à haute entropie.

Le serveur stocke uniquement :

```text
SHA-256(token)
```

Le QR seul ne permet aucune validation. La validation requiert une session de formateur authentifiée.

## Architecture

```text
                       ┌───────────────────────────┐
                       │ Vue/Nuxt Web              │
                       │ Dashboard / Calendrier    │
                       │ Formations / Participants │
                       └─────────────┬─────────────┘
                                     │ HTTPS
                                     ▼
                       ┌───────────────────────────┐
                       │ API Nuxt / TypeScript     │
                       │ Auth / CRUD / Stats / QR  │
                       └──────┬────────────┬───────┘
                              │            │
                              ▼            ▼
                        SQLite/WAL     Rust + Krilla
                                           │
                                           ▼
                                          PDF

                       ┌───────────────────────────┐
                       │ Vue + Capacitor           │
                       │ App mobile formateur      │
                       │ Scan → aperçu → validation│
                       └─────────────┬─────────────┘
                                     │ HTTPS
                                     └──────→ API
```

## Documents du blueprint

- `01-architecture.md`
- `02-database-sqlite.md`
- `03-data-model.md`
- `04-qr-security.md`
- `05-web-app.md`
- `06-mobile-app.md`
- `07-api-contract.md`
- `08-statistics.md`
- `09-pdf-krilla.md`
- `10-security-backup.md`
- `11-deployment.md`
- `12-roadmap.md`
- `schema.sql`
- `sample-report.json`
