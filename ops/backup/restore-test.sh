#!/usr/bin/env bash
# Test de restauration (trimestriel) : « une sauvegarde n'est pas fiable tant qu'elle
# n'a pas été restaurée ». Déchiffre, vérifie les empreintes, lance integrity_check,
# compte les lignes, démarre l'application sur la copie et interroge /api/health.
#
# Usage : restore-test.sh <archive.tar.zst.age> <fichier-identité-age>
set -euo pipefail
umask 077

ARCHIVE=${1:?archive age requise}
IDENTITY=${2:?fichier identite age requis}
APP_DIR=${APP_DIR:-/opt/training-manager/app}
LOG_FILE=${RESTORE_LOG:-/var/log/training-manager/restore-tests.log}
PORT=${RESTORE_PORT:-3999}

work=$(mktemp -d)
trap 'kill "${app_pid:-}" 2>/dev/null || true; rm -rf "$work"' EXIT

if [[ -f "$ARCHIVE.sha256" ]]; then
  (cd "$(dirname "$ARCHIVE")" && sha256sum -c "$(basename "$ARCHIVE").sha256" >/dev/null) || { echo "Empreinte de l'archive invalide"; exit 1; }
fi
age -d -i "$IDENTITY" "$ARCHIVE" | zstd -dq | tar -C "$work" -xf -
(cd "$work/payload" && sha256sum -c SHA256SUMS >/dev/null) || { echo "Empreintes du contenu invalides"; exit 1; }

DB="$work/payload/app.sqlite3"
echo "== Intégrité et comptages"
pnpm --silent --dir "$APP_DIR/database" exec tsx src/cli.ts integrity "$DB"

echo "== Démarrage de l'application sur la copie restaurée (port $PORT)"
NUXT_DATABASE_PATH="$DB" NUXT_AUTO_MIGRATE=false NUXT_REPORTS_DIR="$work/reports" PORT=$PORT HOST=127.0.0.1 \
  node "$APP_DIR/apps/web/.output/server/index.mjs" >"$work/app.log" 2>&1 &
app_pid=$!
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" -o "$work/health.json" 2>/dev/null; then break; fi
  sleep 1
done
grep -q '"database":"ok"' "$work/health.json" || { echo "Healthcheck KO"; cat "$work/app.log"; exit 1; }
cat "$work/health.json"; echo

mkdir -p "$(dirname "$LOG_FILE")"
printf '%s restore-test OK archive=%s\n' "$(date -u +%FT%TZ)" "$(basename "$ARCHIVE")" >> "$LOG_FILE"
echo "Test de restauration réussi — consigné dans $LOG_FILE"
