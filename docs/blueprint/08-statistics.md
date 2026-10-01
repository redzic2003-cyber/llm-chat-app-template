# 08 — Statistiques

## Indicateurs de base

### Sessions

```text
COUNT(training_sessions)
```

### Participations

Nombre total de participants présents, session par session.

Une même personne dans trois sessions compte trois participations.

### Participants uniques

```text
COUNT(DISTINCT participant_id)
```

### Heures de formation

Somme des durées de session.

### Heures-participants

Indicateur très utile :

```text
durée session × nombre de présents
```

Exemple :

```text
2 heures × 10 personnes = 20 heures-participants
```

### Taux de présence

```text
présents / participants attendus × 100
```

## Agrégations

### Jour

```text
YYYY-MM-DD
```

### Semaine ISO

```text
2026-W40
```

### Mois

```text
2026-09
```

### Formation

```text
Sécurité incendie → 44
Travail en hauteur → 31
...
```

### Département

Optionnel.

## Dashboard recommandé

### Ligne 1

```text
Sessions | Participations | Uniques | Heures-participants
```

### Ligne 2

Graphique :

```text
participants par jour / semaine / mois
```

### Ligne 3

Barres horizontales :

```text
participations par type de formation
```

### Ligne 4

```text
taux de présence
absences
durée moyenne
```

## Filtres

Tous les widgets réutilisent les mêmes filtres :

```text
from
to
training_id
trainer_id
department
```

## Performance

Pour le volume prévu, les agrégations SQLite peuvent être calculées en direct.

Ajouter les index sur :

```text
training_sessions.starts_at
enrollments.session_id
enrollments.participant_id
attendance_validations.validated_at
```

Pas besoin de moteur analytique séparé.
