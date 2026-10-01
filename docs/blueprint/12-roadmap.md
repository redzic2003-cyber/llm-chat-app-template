# 12 — Roadmap de réalisation

## Phase 0 — Fondation

- monorepo ;
- Nuxt + TypeScript ;
- SQLite + Drizzle ;
- migrations ;
- authentification ;
- layout de base ;
- lint/test/build CI.

## Phase 1 — Métier de base

- CRUD participants ;
- CRUD formations ;
- CRUD sessions ;
- relation session ↔ participants ;
- calendrier ;
- écran détail session.

**Critère de sortie :**
une session complète peut être créée depuis le web.

## Phase 2 — QR

- générateur de token ;
- hash ;
- stockage ;
- génération image QR ;
- rotation ;
- impression ;
- endpoint resolve ;
- endpoint validate ;
- audit.

**Critère de sortie :**
un QR imprimé peut être scanné et valider une présence.

## Phase 3 — Mobile

- projet Vue + Capacitor ;
- auth ;
- sessions du jour ;
- scanner ;
- aperçu ;
- validation ;
- haptique ;
- gestion erreurs.

**Critère de sortie :**
10 participants peuvent être validés rapidement depuis un téléphone.

## Phase 4 — Dashboard

- KPI ;
- filtres ;
- graphiques ECharts ;
- stats semaine/mois/année ;
- heures-participants ;
- taux de présence.

## Phase 5 — PDF

- service Rust ;
- Krilla ;
- template session ;
- template mensuel ;
- graphiques SVG ;
- stockage rapports ;
- checksum.

## Phase 6 — Durcissement

- RBAC ;
- rate limits ;
- CSP ;
- audit complet ;
- backups ;
- test restore ;
- health checks ;
- logs structurés.

## Phase 7 — V2

Selon besoin :

- import CSV participants ;
- QR permanent collaborateur ;
- mode hors ligne ;
- signature apprenant ;
- attestations ;
- multi-formateurs ;
- multi-sites ;
- notifications ;
- export Excel/CSV ;
- API externe.

## Ordre recommandé

Ne pas commencer par les PDF.

Construire dans cet ordre :

```text
DB
→ CRUD
→ sessions
→ participants
→ QR
→ scan
→ stats
→ PDF
```

Les PDF sont la conséquence des données fiables.
