# 10 — Sécurité, confidentialité et sauvegardes

## Authentification

Minimum :

- mot de passe fort ;
- cookie de session HttpOnly ;
- Secure ;
- SameSite ;
- rotation de session après login ;
- expiration ;
- protection CSRF si nécessaire selon le mécanisme choisi.

Option ultérieure :

- passkeys/WebAuthn ;
- TOTP.

## Autorisations

### admin

Tout.

### trainer

- voir ses sessions ;
- scanner ;
- valider ;
- consulter les participants nécessaires ;
- générer les rapports autorisés.

### viewer

Lecture/statistiques seulement.

## Données personnelles

Limiter les champs.

Pour la V1 :

```text
nom
prénom
matricule interne
département optionnel
```

Ne collecter rien qui n'est pas nécessaire.

## QR

- token aléatoire ;
- hash en base ;
- aucun PII ;
- révocable ;
- rotation possible ;
- pas de token dans les logs.

## API

- HTTPS obligatoire ;
- rate limit sur login et scan ;
- validation Zod de tous les payloads ;
- paramètres SQL via ORM ;
- Content Security Policy sur le web ;
- CORS restrictif.

## Audit

Tracer :

- création/modification session ;
- ajout/retrait participant ;
- génération/rotation QR ;
- validation/annulation présence ;
- génération rapport ;
- changements de droits.

## Sauvegarde SQLite

Script quotidien :

```bash
sqlite3 /var/lib/training-manager/db/app.sqlite3 \
  ".backup '/var/backups/training-manager/app-$(date +%F-%H%M).sqlite3'"
```

Puis :

- checksum ;
- compression ;
- chiffrement ;
- copie vers une deuxième destination.

## Test de restauration

Une sauvegarde n'est pas fiable tant qu'elle n'a pas été restaurée.

Procédure :

1. copier backup dans environnement test ;
2. lancer `PRAGMA integrity_check`;
3. démarrer l'application ;
4. vérifier sessions, participants et présences ;
5. consigner la date du test.

## Logs

Ne jamais écrire :

- mot de passe ;
- cookie ;
- bearer token ;
- token QR brut.

## Rétention

Définir une règle interne claire pour :

- participants inactifs ;
- historique de présence ;
- rapports ;
- logs techniques ;
- audit logs.
