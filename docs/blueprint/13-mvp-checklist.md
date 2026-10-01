# 13 — Checklist MVP

## Base

- [ ] SQLite créé
- [ ] WAL activé
- [ ] migrations
- [ ] seed admin
- [ ] sauvegarde automatique

## Auth

- [ ] login
- [ ] logout
- [ ] session
- [ ] admin/trainer/viewer
- [ ] permissions testées

## Formations

- [ ] créer
- [ ] modifier
- [ ] désactiver
- [ ] référence unique

## Participants

- [ ] créer
- [ ] modifier
- [ ] rechercher
- [ ] désactiver

## Sessions

- [ ] calendrier
- [ ] création
- [ ] horaire
- [ ] formateur
- [ ] lieu
- [ ] participants
- [ ] statut

## QR

- [ ] token 256 bits
- [ ] Base64URL
- [ ] SHA-256 côté serveur
- [ ] aucun PII
- [ ] rotation
- [ ] révocation
- [ ] scan resolve
- [ ] confirmation validate
- [ ] double-validation gérée

## Mobile

- [ ] login
- [ ] sessions du jour
- [ ] caméra
- [ ] scan
- [ ] affichage participant
- [ ] validation
- [ ] vibration
- [ ] erreurs explicites

## Statistiques

- [ ] jour
- [ ] semaine
- [ ] mois
- [ ] année
- [ ] participants
- [ ] uniques
- [ ] heures formation
- [ ] heures-participants
- [ ] taux présence

## PDF

- [ ] service Rust
- [ ] Krilla
- [ ] rapport session
- [ ] rapport mensuel
- [ ] graphiques SVG
- [ ] checksum

## Production

- [ ] HTTPS
- [ ] rate limit
- [ ] CSP
- [ ] logs structurés
- [ ] backup hors machine
- [ ] restauration testée
- [ ] healthcheck
