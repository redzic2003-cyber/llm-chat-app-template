# 09 — Génération PDF avec Krilla

## Architecture

```text
Nuxt API
   │
   │ JSON interne
   ▼
Rust PDF service
   │
   ├── layout
   ├── charts SVG
   ├── tables
   ├── pagination
   └── Krilla
        │
        ▼
       PDF
```

## Pourquoi isoler Krilla

Avantages :

- pas de logique métier dans Rust ;
- service PDF testable indépendamment ;
- API principale simple ;
- possibilité de changer le moteur PDF plus tard ;
- sécurité plus claire.

## Types de rapports

### Rapport mensuel

Page 1 :

```text
Bilan de formation — Septembre 2026
Période
KPI
```

Page 2 :

```text
Répartition par formation
graphique horizontal
tableau
```

Page 3 :

```text
participants par jour
participants par semaine
```

Page 4+ :

```text
liste détaillée des sessions
```

### Rapport session

```text
Formation
Référence
Date
Horaire
Formateur
Lieu

Participants
Statut
Heure de validation
```

### Rapport participant

Historique individuel :

```text
Nom
Prénom
Référence interne
Toutes les formations validées
Total heures
```

## Pipeline graphique

Ne pas capturer les graphiques du navigateur.

Préférer :

```text
dataset
→ génération SVG
→ insertion vectorielle dans Krilla
```

Ainsi :

- netteté parfaite ;
- poids raisonnable ;
- impression professionnelle.

## Contrat du service

```http
POST /render
Content-Type: application/json
```

Réponse :

```text
application/pdf
```

Le service n'est accessible que localement :

```text
127.0.0.1:8090
```

ou via réseau Docker interne.

## Fonts

Embarquer explicitement les polices utilisées dans le service.

Éviter de dépendre des polices système de la machine.

## Métadonnées

Ajouter :

```text
Title
Author
CreationDate
Report period
Application version
```

## Signature du fichier

Après génération :

```text
SHA-256(pdf)
```

Conserver l'empreinte en base pour vérifier l'intégrité.
