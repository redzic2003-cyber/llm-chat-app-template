# 02 — SQLite : choix et configuration

## Pourquoi SQLite est pertinent

Cette application n'a pas besoin d'un serveur SQL séparé au départ.

Les opérations principales sont :

- lire le calendrier ;
- créer/modifier une session ;
- ajouter quelques participants ;
- enregistrer une validation de présence ;
- agréger des statistiques.

Même avec 50 000 présences, SQLite reste très à l'aise sur un petit VPS.

## Configuration recommandée

Au démarrage :

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

### WAL

Le mode WAL permet :

- plusieurs lecteurs pendant une écriture ;
- une meilleure fluidité ;
- moins de blocages pour le dashboard.

## Ce qu'il ne faut pas stocker dans SQLite

Éviter d'y mettre :

- PDF binaires ;
- images ;
- photos ;
- gros fichiers.

Stocker les PDF générés dans :

```text
/var/lib/training-manager/reports/
```

ou dans un stockage objet plus tard.

SQLite conserve seulement :

```text
report_id
path
sha256
created_at
```

## Fichier

Exemple :

```text
/var/lib/training-manager/db/app.sqlite3
```

Permissions :

```text
owner = training-manager
mode = 0600
```

Le répertoire :

```text
0700
```

## Sauvegardes

Ne pas faire une simple copie brute du fichier pendant des écritures.

Utiliser :

```bash
sqlite3 app.sqlite3 ".backup '/backup/app-YYYYMMDD-HHMM.sqlite3'"
```

Puis compresser/chiffrer la sauvegarde.

## Politique simple

- 1 sauvegarde quotidienne ;
- 7 quotidiennes ;
- 4 hebdomadaires ;
- 12 mensuelles ;
- test de restauration trimestriel.

## Seuil de migration vers PostgreSQL

Migrer lorsque l'une de ces conditions apparaît :

- plusieurs serveurs applicatifs ;
- plusieurs sites géographiques écrivant simultanément ;
- centaines d'écritures concurrentes ;
- multi-tenant SaaS ;
- réplication active ;
- besoins SQL analytiques beaucoup plus lourds.

Pour un outil interne de formation : SQLite est parfaitement cohérent.
