# 06 — Application mobile Vue + Capacitor

## Pourquoi Capacitor

Le besoin natif est réduit :

- caméra ;
- scan QR ;
- haptique ;
- stockage sécurisé ;
- réseau.

Vue + Capacitor évite d'introduire React uniquement pour l'app mobile.

## Écrans

### 1. Login

```text
Email
Mot de passe
Connexion
```

### 2. Sessions du jour

```text
Aujourd'hui

08:00  Sécurité incendie     7/10
13:30  Travail en hauteur    3/8
```

### 3. Session

```text
Sécurité incendie
SEC-INC-01
7 / 10 présents

[ SCANNER ]

✓ Dupont Jean
✓ Martin Paul
○ Robert Luc
```

### 4. Scanner

Caméra plein écran.

Après lecture :

```text
QR reconnu
↓
appel /api/scans/resolve
↓
fiche participant
```

### 5. Confirmation

```text
Jean DUPONT

Sécurité incendie
15.10.2026
08:00–10:00

[ VALIDER ]
[ ANNULER ]
```

### 6. Résultat

Succès :

```text
✓ VALIDÉ
Jean Dupont
08:42
```

- vibration courte ;
- signal sonore optionnel ;
- retour automatique au scanner après ~1 seconde.

Erreur :

```text
QR INCONNU
QR RÉVOQUÉ
MAUVAISE SESSION
DÉJÀ VALIDÉ
```

## Mode rapide

Option :

```text
"Validation rapide"
```

Après une première confirmation explicite, les scans suivants peuvent afficher l'identité et être validés par un geste unique.

Ne jamais faire un scan silencieux sans feedback.

## Mode hors ligne — V2

Avant session :

```text
download session pack
```

Contenu :

- identifiants enrollment ;
- hashes locaux autorisés ;
- nom/prénom minimaux ;
- fenêtre temporelle.

Chaque validation est stockée dans une queue locale :

```text
pending_attendance
```

Puis synchronisée.

Prévoir :

- idempotency key ;
- horodatage local ;
- heure serveur lors de la synchronisation ;
- gestion des conflits.
