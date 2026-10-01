# 11 — Déploiement minimal

## Machine

Un petit VPS Linux suffit.

Exemple logique :

```text
2 vCPU
2–4 Go RAM
SSD
```

Ce n'est pas une exigence stricte : la charge est très faible.

## Services

```text
reverse-proxy
nuxt-app
pdf-service
```

SQLite est un fichier local, pas un conteneur DB séparé.

## Arborescence serveur

```text
/opt/training-manager/
  app/
  pdf-service/

/var/lib/training-manager/
  db/
  reports/

/var/backups/training-manager/
```

## Reverse proxy

```text
https://formations.example.ch
```

Le proxy termine TLS et transfère vers Nuxt.

Le service PDF reste privé :

```text
127.0.0.1:8090
```

## Process management

Option simple :

```text
systemd
```

Services :

```text
training-web.service
training-pdf.service
training-backup.timer
```

## Déploiement

```text
git push
↓
CI
↓
tests
↓
build Nuxt
↓
build Rust release
↓
copie artefacts
↓
migration SQLite
↓
restart
↓
healthcheck
```

## Healthchecks

Web :

```http
GET /api/health
```

Retour :

```json
{
  "status": "ok",
  "database": "ok",
  "pdfService": "ok"
}
```

## Monitoring minimal

- uptime ;
- espace disque ;
- taille DB ;
- erreurs 5xx ;
- échecs de backup ;
- temps de génération PDF.

## Mise à jour DB

Drizzle migrations versionnées.

Toujours :

```text
backup
→ migration
→ smoke test
```
