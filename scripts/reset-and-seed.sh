#!/bin/bash
# Reset database and reseed with 10 Malmö users. Password: password123!
# Run from project root.

set -e
cd "$(dirname "$0")/.."

echo "Stopping PocketBase..."
pkill -f pocketbase 2>/dev/null || true
sleep 2

echo "Resetting database..."
rm -rf pb_data

echo "Starting PocketBase (migrations will run)..."
./pocketbase serve &
sleep 6

echo "Creating admin..."
./pocketbase superuser upsert admin@test.com adminpass123 2>/dev/null || true

echo "Seeding postal codes from CSV..."
node scripts/seed-postal-codes.mjs

echo "Seeding 10 Malmö users via API..."
cd app && node scripts/seed-malmo.mjs

echo ""
echo "PocketBase running at http://127.0.0.1:8090"
echo "Seed users: anna.malmo@example.com, erik.malmo@example.com, ... (all password: password123!)"
