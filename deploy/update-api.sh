#!/usr/bin/env bash
set -euo pipefail
ROOT=/data/704-class-system
ENV_FILE="$HOME/.config/704-api/mail-0194.env"
IMAGE=announcement704/704-api:0.30.1
TEST=api704-v0301-test
test -f "$ENV_FILE"
test -d "$ROOT/uploads"
git -C "$ROOT/source" pull --ff-only origin main
docker build -t "$IMAGE" "$ROOT/source/server"
docker create --name "$TEST" --network 1panel-network --restart no \
  -p 127.0.0.1:7041:7040 --env-file "$ENV_FILE" \
  -v "$ROOT/uploads:/data/chat-files" "$IMAGE"
trap 'docker rm -f "$TEST" >/dev/null 2>&1 || true' EXIT
docker start "$TEST"
ready() {
  for attempt in {1..30}; do
    if curl --max-time 3 -fsS "http://127.0.0.1:$1/public/auth-config" | grep -q 'firebase'; then return 0; fi
    sleep 2
  done
  return 1
}
ready 7041
docker exec "$TEST" sh -c 'test -w /data/chat-files'
docker rm -f "$TEST"
BACKUP="api704-pre-v0301-$(date +%Y%m%d-%H%M%S)"
docker stop api704
docker rename api704 "$BACKUP"
rollback() {
  docker rm -f api704 >/dev/null 2>&1 || true
  docker rename "$BACKUP" api704
  docker start api704
  echo 'DEPLOY_FAILED: previous API restored'
}
if docker create --name api704 --network 1panel-network --restart unless-stopped \
  -p 127.0.0.1:7040:7040 --env-file "$ENV_FILE" \
  -v "$ROOT/uploads:/data/chat-files" "$IMAGE" && docker start api704 && ready 7040; then
  echo "DEPLOY_OK v0.30.1; BACKUP=$BACKUP"
else
  rollback
  exit 1
fi
