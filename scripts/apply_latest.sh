#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "📥 Pulling latest code..."
git pull

echo "🔨 Building pocketbase and app (no cache)..."
sudo docker compose build --no-cache pocketbase app

echo "🚀 Starting containers..."
sudo docker compose up -d

echo "✅ Done."
