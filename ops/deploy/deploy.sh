#!/usr/bin/env bash
# Déploiement (docs/blueprint/11-deployment.md) :
#   tests → build Nuxt → build Rust release → sauvegarde → migration → redémarrage → healthcheck
#
# Usage (sur le serveur, utilisateur avec sudo) : ops/deploy/deploy.sh <ref git>
set -euo pipefail

REF=${1:-main}
APP_DIR=${APP_DIR:-/opt/training-manager/app}
PDF_DIR=${PDF_DIR:-/opt/training-manager/pdf-service}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:3000/api/health}
RUN_AS=${RUN_AS:-training-manager}

step() { printf '\n==> %s\n' "$*"; }

cd "$APP_DIR"
step "Récupération de $REF"
git fetch --tags origin
git checkout --detach "$REF"
export APP_VERSION
APP_VERSION=$(git describe --tags --always)

step "Dépendances et tests"
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test

step "Build web"
pnpm --filter @tm/web build

step "Build service PDF (release)"
cargo build --release --locked --manifest-path services/pdf/Cargo.toml
sudo install -m 0755 services/pdf/target/release/training-pdf "$PDF_DIR/training-pdf.new"

step "Sauvegarde avant migration"
sudo systemctl start training-backup.service

step "Migration SQLite"
db_env=$(grep -E '^NUXT_DATABASE_PATH=' /etc/training-manager/web.env)
sudo -u "$RUN_AS" env "$db_env" pnpm db:migrate

step "Redémarrage"
sudo mv "$PDF_DIR/training-pdf.new" "$PDF_DIR/training-pdf"
sudo systemctl restart training-pdf.service training-web.service

step "Healthcheck"
for _ in $(seq 1 30); do
  if body=$(curl -fsS "$HEALTH_URL" 2>/dev/null) && grep -q '"database":"ok"' <<<"$body"; then
    echo "$body"
    grep -q '"pdfService":"ok"' <<<"$body" || echo "ATTENTION : service PDF indisponible"
    echo "Déploiement $APP_VERSION terminé."
    exit 0
  fi
  sleep 2
done
echo "Healthcheck en échec : vérifier journalctl -u training-web -u training-pdf" >&2
exit 1
