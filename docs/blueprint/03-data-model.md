# 03 — Modèle de données

## Entités

### users

Compte autorisé à utiliser le système.

```text
id
email
display_name
role
password_hash / auth provider id
created_at
disabled_at
```

Rôles initiaux :

```text
admin
trainer
viewer
```

### participants

```text
id
employee_ref
first_name
last_name
department
email (optionnel)
active
created_at
updated_at
```

`employee_ref` peut être le matricule interne si disponible.

### trainings

Le type de formation.

Exemples :

- Sécurité incendie
- Travail en hauteur
- Sauvetage camarade
- 1/4 heure sécurité

```text
id
reference
title
description
default_duration_minutes
active
created_at
updated_at
```

### training_sessions

Une occurrence datée d'une formation.

```text
id
training_id
trainer_id
starts_at
ends_at
location
status
notes
created_at
updated_at
```

Status :

```text
draft
planned
in_progress
completed
cancelled
```

### enrollments

Lien entre une session et un participant.

```text
id
session_id
participant_id
status
created_at
```

Status :

```text
invited
expected
present
absent
excused
```

Contrainte :

```text
UNIQUE(session_id, participant_id)
```

### qr_tokens

```text
id
enrollment_id
token_hash
created_at
expires_at
revoked_at
last_scanned_at
scan_count
```

Le token brut n'est pas conservé après génération.

### attendance_validations

Historique de validation.

```text
id
enrollment_id
validated_by
validated_at
method
device_id
note
```

On peut conserver un seul enregistrement "actif" de validation ou un historique complet.

### audit_logs

```text
id
actor_user_id
action
entity_type
entity_id
timestamp
metadata_json
```

Exemples :

```text
SESSION_CREATED
PARTICIPANT_ADDED
QR_REGENERATED
ATTENDANCE_VALIDATED
ATTENDANCE_CANCELLED
REPORT_GENERATED
```

### reports

```text
id
type
period_start
period_end
file_path
sha256
generated_by
created_at
```

## Relations

```text
training
   │ 1
   │
   └──── N training_session
              │
              ├──── N enrollment ──── 1 participant
              │          │
              │          └──── 0..N attendance_validation
              │
              └──── 1 trainer(user)
```
