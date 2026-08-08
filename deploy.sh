#!/usr/bin/env bash
# Deploy por git. Se corre EN EL VPS, no en tu laptop.
#   ssh root@188.245.211.163 'cd /opt/hackatones/altoke && ./deploy.sh'
set -euo pipefail
cd "$(dirname "$0")"

echo "==> pull"
git pull --ff-only

echo "==> build + up"
docker compose up -d --build

echo "==> esperando"
sleep 6
docker compose ps
curl -fsS http://127.0.0.1:3011/api/health && echo
