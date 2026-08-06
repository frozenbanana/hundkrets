#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "📥 Pulling latest code..."
git pull --ff-only

echo "🔨 Building pocketbase and app (no cache)..."
export VITE_POCKETBASE_URL="${VITE_POCKETBASE_URL:-https://api.hundkrets.se}"
docker compose build --no-cache pocketbase app

echo "🚀 Starting containers..."
docker compose up -d

echo "✅ Done."
docker compose ps
