# 01 — Architecture complète

## 1. Périmètre fonctionnel

### Web

- connexion formateur/admin ;
- dashboard ;
- calendrier semaine/mois ;
- catalogue des formations ;
- création/modification de sessions ;
- gestion des participants ;
- ajout de participants à une session ;
- génération des QR ;
- statut de présence en direct ;
- statistiques ;
- exports PDF ;
- historique/audit.

### Mobile

L'application mobile reste volontairement petite :

- connexion ;
- sessions du jour ;
- détail d'une session ;
- scanner QR ;
- résolution du QR ;
- confirmation manuelle ;
- retour visuel/haptique ;
- file de synchronisation locale optionnelle.

### PDF

Le moteur PDF est un composant séparé.

Entrée :

```json
{
  "reportType": "monthly",
  "period": {},
  "summary": {},
  "trainingBreakdown": [],
  "dailySeries": []
}
```

Sortie :

```text
application/pdf
```

## 2. Monorepo

```text
training-manager/
├── apps/
│   ├── web/                 # Nuxt
│   └── mobile/              # Vue + Capacitor
│
├── packages/
│   ├── shared-types/
│   ├── schemas/
│   ├── api-client/
│   ├── qr-core/
│   └── analytics/
│
├── services/
│   └── pdf/
│       ├── Cargo.toml
│       └── src/
│
├── database/
│   ├── migrations/
│   ├── schema/
│   └── seeds/
│
├── ops/
│   ├── nginx/
│   ├── backup/
│   └── systemd/
│
└── docs/
```

## 3. Règle de séparation

Le frontend ne doit jamais :

- décider seul qu'une présence est valide ;
- décoder une identité depuis le QR ;
- écrire directement dans SQLite ;
- générer des identifiants QR prévisibles.

L'API est l'autorité.

Le service Krilla ne gère pas :

- l'authentification ;
- les droits ;
- la base ;
- les QR ;
- les sessions utilisateur.

Il reçoit des données déjà filtrées et fabrique uniquement des documents.

## 4. Flux d'une présence

```text
1. L'administrateur crée une session
2. Il ajoute Jean Dupont
3. Le serveur crée un token aléatoire
4. Le serveur stocke uniquement SHA-256(token)
5. Le QR imprimé contient TRN1:<token>
6. Le formateur scanne avec l'app mobile
7. L'app envoie le token à POST /api/scans/resolve
8. Le serveur hash le token
9. Le serveur retrouve la participation
10. Le serveur renvoie identité + session + statut
11. Le formateur appuie sur VALIDER
12. POST /api/attendance/:id/validate
13. Transaction SQLite
14. Audit log
15. Dashboard immédiatement à jour
```

## 5. Principes d'implémentation

- UTC en base pour les timestamps techniques ;
- timezone d'affichage configurable ;
- IDs internes UUIDv7 ou ULID ;
- références humaines séparées des IDs techniques ;
- contraintes SQL pour empêcher les doublons ;
- suppression logique pour les participants et formations si historique existant ;
- transactions pour toute validation de présence ;
- génération des statistiques côté serveur ;
- aucun calcul métier sensible uniquement côté client.
