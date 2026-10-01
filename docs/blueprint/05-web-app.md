# 05 — Application Web Vue/Nuxt

## Navigation

```text
Dashboard
Calendrier
Formations
Participants
Rapports
Paramètres
```

## Dashboard

Cartes KPI :

```text
Sessions cette semaine
Participations cette semaine
Participants uniques
Heures de formation
Heures-participants
Taux de présence
```

Graphiques :

- participants par jour ;
- participants par semaine ;
- participants par mois ;
- répartition par formation ;
- répartition par département ;
- heures-participants ;
- absences.

Filtres :

```text
7 jours
30 jours
mois courant
trimestre
année
période personnalisée
```

## Calendrier

Vues :

```text
mois
semaine
jour
liste
```

Carte de session :

```text
08:00–10:00
Sécurité incendie
SEC-INC-01
8 / 12 validés
```

Clic :

```text
/session/:id
```

## Écran session

En-tête :

```text
Sécurité incendie
SEC-INC-01

15.10.2026
08:00–10:00
Local EHS
Formateur : ...
```

Liste :

```text
Participant          Statut         Validation
Jean Dupont          Présent        08:17
Marc Simon           À valider      -
...
```

Actions :

```text
Ajouter participant
Générer QR
Imprimer fiches/QCM
Exporter liste
Clôturer session
Générer rapport
```

## Formations

CRUD simple :

```text
référence
titre
description
durée standard
actif/inactif
```

## Participants

Recherche instantanée :

```text
nom
prénom
matricule
département
```

Import CSV optionnel.

## UX

Objectif :

- aucune page surchargée ;
- actions principales visibles ;
- formulaires courts ;
- clavier utilisable ;
- interface desktop/tablette ;
- aucun framework CSS obligatoire.

## Design

Style recommandé :

- fond clair ;
- cartes sobres ;
- typographie système ;
- 1 couleur d'accent ;
- état succès/alerte/erreur clairement distinct ;
- graphiques propres, sans effets décoratifs inutiles.
