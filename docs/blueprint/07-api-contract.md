# 07 — API

Préfixe :

```text
/api/v1
```

## Auth

```http
POST /auth/login
POST /auth/logout
GET  /auth/session
```

## Formations

```http
GET    /trainings
POST   /trainings
GET    /trainings/:id
PATCH  /trainings/:id
DELETE /trainings/:id
```

Suppression logique recommandée.

## Sessions

```http
GET    /sessions?from=&to=
POST   /sessions
GET    /sessions/:id
PATCH  /sessions/:id
POST   /sessions/:id/complete
POST   /sessions/:id/cancel
```

## Participants

```http
GET    /participants?q=
POST   /participants
GET    /participants/:id
PATCH  /participants/:id
POST   /participants/import
```

## Enrollments

```http
POST   /sessions/:id/enrollments
DELETE /sessions/:id/enrollments/:enrollmentId
GET    /sessions/:id/enrollments
```

## QR

```http
POST /enrollments/:id/qr
POST /enrollments/:id/qr/rotate
POST /scans/resolve
```

### resolve

Request :

```json
{
  "payload": "TRN1:..."
}
```

Response :

```json
{
  "status": "ok",
  "enrollmentId": "01...",
  "participant": {
    "firstName": "Jean",
    "lastName": "Dupont"
  },
  "session": {
    "title": "Sécurité incendie",
    "reference": "SEC-INC-01",
    "startsAt": "2026-10-15T06:00:00Z",
    "endsAt": "2026-10-15T08:00:00Z"
  },
  "attendance": {
    "status": "pending"
  }
}
```

## Présences

```http
POST /attendance/:enrollmentId/validate
POST /attendance/:enrollmentId/revoke
```

Validation request :

```json
{
  "idempotencyKey": "01..."
}
```

## Statistiques

```http
GET /stats/summary?from=&to=
GET /stats/by-training?from=&to=
GET /stats/by-day?from=&to=
GET /stats/by-week?from=&to=
GET /stats/by-month?from=&to=
GET /stats/by-department?from=&to=
```

## Rapports

```http
POST /reports
GET  /reports/:id
GET  /reports/:id/download
```

Request :

```json
{
  "type": "monthly",
  "from": "2026-09-01",
  "to": "2026-09-30"
}
```

## Erreurs

Format uniforme :

```json
{
  "error": {
    "code": "QR_REVOKED",
    "message": "Ce QR n'est plus valide."
  }
}
```

Codes utiles :

```text
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
VALIDATION_ERROR
QR_INVALID
QR_NOT_FOUND
QR_REVOKED
QR_EXPIRED
ATTENDANCE_ALREADY_VALIDATED
SESSION_CANCELLED
SESSION_CLOSED
```
