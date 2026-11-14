#!/usr/bin/env bash
# Safe production deployment for the AI Robot platform.
# This script is invoked by AWS Systems Manager as root.

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.prod.yml)

compose() {
  sudo docker compose --parallel 1 "${COMPOSE_FILES[@]}" "$@"
}

on_error() {
  local exit_code=$?
  echo "ERROR: Deployment failed (exit code $exit_code). Recent container state and logs:"
  compose ps || true
  compose logs --tail=100 || true
  exit "$exit_code"
}
trap on_error ERR

echo "Starting AI Robot production deployment..."
echo "Repository: $REPO_ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is not installed."
  exit 1
fi

if [[ ! -s ".env" ]]; then
  echo "ERROR: Production .env is missing or empty."
  exit 1
fi

chmod 600 .env

echo "Validating Docker Compose configuration..."
compose config --quiet

echo "Pulling runtime images..."
compose pull caddy redis

echo "Building application images sequentially to limit RAM usage..."
compose build backend ai-services

echo "Validating Caddy configuration..."
compose run --rm --no-deps caddy caddy validate \
  --config /etc/caddy/Caddyfile --adapter caddyfile

echo "Applying production services without taking the stack down..."
compose up -d --remove-orphans --wait --wait-timeout 180

echo "Reloading Caddy configuration..."
compose exec -T caddy caddy reload \
  --config /etc/caddy/Caddyfile --adapter caddyfile

echo "Checking backend health..."
HEALTH_OK=false
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 8 \
      http://127.0.0.1:3000/health 2>/dev/null | grep -q '"status":"ok"'; then
    HEALTH_OK=true
    break
  fi
  echo "Waiting for backend health ($attempt/30)..."
  sleep 5
done

if [[ "$HEALTH_OK" != true ]]; then
  echo "ERROR: Backend health check did not succeed."
  compose ps
  compose logs --tail=100 backend ai-services caddy
  exit 1
fi

echo "Final service status:"
compose ps

echo "Removing dangling images only (volumes and persistent data are untouched)..."
sudo docker image prune -f

echo "Deployment completed and backend health check passed."
echo "REST API: https://107.23.154.150.sslip.io"
echo "ESP32 WSS: wss://107.23.154.150.sslip.io/ws/esp32"
