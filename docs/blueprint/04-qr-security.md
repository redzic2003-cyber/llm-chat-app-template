# 04 — QR codes et sécurité

## Format du QR

Le QR contient uniquement :

```text
TRN1:<token>
```

`TRN1` = version du format.

Exemple conceptuel :

```text
TRN1:W3d5ykF6E4SJP7jkfjqO-xHBwpMKt4n0YkL6NDhhNHY
```

## Token

Génération :

- 32 octets aléatoires ;
- CSPRNG système ;
- encodage Base64URL sans padding.

Entropie : 256 bits.

## Stockage

Le serveur calcule :

```text
SHA-256(token)
```

et stocke seulement ce hash.

Pseudo-code :

```ts
const raw = randomBytes(32)
const token = base64url(raw)
const digest = sha256(token)
```

## Pourquoi ne pas utiliser un hash dérivé du participant

Mauvais :

```text
SHA256("Jean Dupont:SEC-001:2026-10-12")
```

Les données sont prévisibles.

Bon :

```text
randomBytes(32)
```

## Résolution

```http
POST /api/scans/resolve
Authorization: Bearer <session>
Content-Type: application/json

{
  "payload": "TRN1:..."
}
```

Le serveur :

1. vérifie l'authentification ;
2. vérifie le préfixe ;
3. extrait le token ;
4. calcule SHA-256 ;
5. recherche le hash ;
6. vérifie révocation/expiration ;
7. charge enrollment + participant + session ;
8. retourne un aperçu sans modifier la présence.

## Validation

La présence n'est pas validée lors du simple scan.

Deuxième action :

```http
POST /api/attendance/{enrollmentId}/validate
```

Le serveur contrôle :

- rôle formateur/admin ;
- session valide ;
- enrollment valide ;
- absence de conflit ;
- transaction SQL.

## Anti-double validation

Contrainte logique :

```text
une présence active maximum par enrollment
```

Deuxième scan :

```text
ALREADY_VALIDATED
validated_at
validated_by
```

## QR compromis

Un administrateur peut :

```text
révoquer token
→ générer nouveau token
→ ancien QR devient inutilisable
```

## Protection contre l'énumération

Les endpoints ne prennent jamais :

```text
/participant/123
```

depuis le QR.

Le token doit être impossible à deviner.

## Données dans le QR

Ne jamais mettre :

- nom ;
- prénom ;
- matricule ;
- email ;
- date de naissance ;
- formation ;
- session ;
- URL contenant ces informations.

## Journalisation

Pour chaque scan :

```text
timestamp
user
device
result
enrollment_id si trouvé
```

Ne pas loguer le token brut.
