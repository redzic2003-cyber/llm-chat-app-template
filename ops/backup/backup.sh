#!/usr/bin/env bash
# Sauvegarde SQLite cohérente, vérifiée, compressée, chiffrée et copiée hors machine.
# Rétention : 7 quotidiennes, 4 hebdomadaires, 12 mensuelles (docs/blueprint/02 & 10).
#
# Variables (fichier /etc/training-manager/backup.env) :
#   DB_PATH          base SQLite             (défaut /var/lib/training-manager/db/app.sqlite3)
#   REPORTS_DIR      PDF générés             (défaut /var/lib/training-manager/reports)
#   BACKUP_DIR       destination locale      (défaut /var/backups/training-manager)
#   AGE_RECIPIENTS   fichier de clés publiques age (obligatoire : pas de sauvegarde en clair)
#   BACKUP_REMOTE    copie hors machine : « rsync:user@hôte:/chemin » ou « rclone:remote:chemin » (recommandé)
#   APP_DIR          dépôt applicatif, pour le repli Node si sqlite3 est absent (défaut /opt/training-manager/app)
set -euo pipefail
umask 077

DB_PATH=${DB_PATH:-/var/lib/training-manager/db/app.sqlite3}
REPORTS_DIR=${REPORTS_DIR:-/var/lib/training-manager/reports}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/training-manager}
AGE_RECIPIENTS=${AGE_RECIPIENTS:-/etc/training-manager/backup-recipients.txt}
BACKUP_REMOTE=${BACKUP_REMOTE:-}
APP_DIR=${APP_DIR:-/opt/training-manager/app}
STAMP=$(date -u +%F-%H%M)

log() { printf '{"time":"%s","level":"%s","event":"%s"%s}\n' "$(date -u +%FT%TZ)" "$1" "$2" "${3:+,$3}"; }
fail() { log error backup.failed "\"reason\":\"$1\""; exit 1; }

command -v age >/dev/null || fail "age introuvable (apt install age)"
command -v zstd >/dev/null || fail "zstd introuvable (apt install zstd)"
[[ -r "$AGE_RECIPIENTS" ]] || fail "fichier de destinataires age illisible : $AGE_RECIPIENTS"
[[ -r "$DB_PATH" ]] || fail "base introuvable : $DB_PATH"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/payload"

# 1. Copie cohérente (jamais de copie brute pendant des écritures).
if command -v sqlite3 >/dev/null; then
  sqlite3 "$DB_PATH" ".backup '$work/payload/app.sqlite3'"
  [[ "$(sqlite3 "$work/payload/app.sqlite3" 'PRAGMA integrity_check;')" == "ok" ]] || fail "integrity_check KO"
else
  NUXT_DATABASE_PATH="$DB_PATH" pnpm --silent --dir "$APP_DIR/database" exec tsx src/cli.ts backup "$work/payload/app.sqlite3" >/dev/null
  pnpm --silent --dir "$APP_DIR/database" exec tsx src/cli.ts integrity "$work/payload/app.sqlite3" >/dev/null || fail "integrity_check KO"
fi

# 2. Rapports PDF (leurs empreintes SHA-256 sont dans la base).
if [[ -d "$REPORTS_DIR" ]]; then
  tar -C "$(dirname "$REPORTS_DIR")" -cf "$work/payload/reports.tar" "$(basename "$REPORTS_DIR")"
fi

# 3. Empreintes, compression, chiffrement.
(cd "$work/payload" && sha256sum ./* > SHA256SUMS)
archive="training-manager-$STAMP.tar.zst.age"
tar -C "$work" -cf - payload | zstd -q -19 | age -R "$AGE_RECIPIENTS" -o "$work/$archive"
sha256sum "$work/$archive" | sed "s#$work/##" > "$work/$archive.sha256"

# 4. Rotation : quotidienne, hebdomadaire (dimanche), mensuelle (le 1er).
mkdir -p "$BACKUP_DIR"/{daily,weekly,monthly}
install -m 0600 "$work/$archive" "$work/$archive.sha256" "$BACKUP_DIR/daily/"
if [[ "$(date -u +%u)" == "7" ]]; then cp "$BACKUP_DIR/daily/$archive"* "$BACKUP_DIR/weekly/"; fi
if [[ "$(date -u +%d)" == "01" ]]; then cp "$BACKUP_DIR/daily/$archive"* "$BACKUP_DIR/monthly/"; fi

prune() { # garde les N archives les plus récentes d'un dossier
  local dir=$1 keep=$2 old
  local -a files=()
  mapfile -t files < <(find "$dir" -maxdepth 1 -name '*.age' -printf '%T@ %p\n' | sort -rn | cut -d' ' -f2-)
  for old in "${files[@]:keep}"; do rm -f "$old" "$old.sha256"; done
}
prune "$BACKUP_DIR/daily" 7
prune "$BACKUP_DIR/weekly" 4
prune "$BACKUP_DIR/monthly" 12

# 5. Deuxième destination.
case "$BACKUP_REMOTE" in
  rsync:*) rsync -a --delete "$BACKUP_DIR/" "${BACKUP_REMOTE#rsync:}/" ;;
  rclone:*) rclone sync "$BACKUP_DIR" "${BACKUP_REMOTE#rclone:}" ;;
  "") log warn backup.no_remote '"hint":"définir BACKUP_REMOTE pour une copie hors machine"' ;;
  *) fail "BACKUP_REMOTE non reconnu" ;;
esac

log info backup.done "\"archive\":\"$archive\",\"bytes\":$(stat -c %s "$BACKUP_DIR/daily/$archive")"
