#!/bin/bash

# Deploy Hundkrets to home server
# This script builds the frontend and deploys to /home/henry/Services/hundkrets

set -e

echo "🚀 Deploying Hundkrets to home server..."

# 1. Build frontend
echo "📦 Building frontend..."
cd app
/home/henry/.asdf/installs/nodejs/25.4.0/bin/npm run build
cd ..

# 2. Create deploy directory on server
echo "📁 Creating deploy directory on server..."
sshpass -p "LisaFlickv'n" ssh henry@192.168.0.242 "mkdir -p /home/henry/Services/hundkrets"

# 3. Copy relevant files to server
echo "📤 Copying files to server..."
scp -r app/dist/ henry@192.168.0.242:/home/henry/Services/hundkrets/app/
scp pocketbase henry@192.168.0.242:/home/henry/Services/hundkrets/
scp docker-compose.yml henry@192.168.0.242:/home/henry/Services/hundkrets/
scp .env henry@192.168.0.242:/home/henry/Services/hundkrets/
scp pb_migrations/ henry@192.168.0.242:/home/henry/Services/hundkrets/
scp pb_hooks/ henry@192.168.0.242:/home/henry/Services/hundkrets/
scp docker/ henry@192.168.0.242:/home/henry/Services/hundkrets/
scp scripts/ henry@192.168.0.242:/home/henry/Services/hundkrets/

# 4. Start Docker Compose on server
echo "🐳 Starting Docker Compose on server..."
ssh henry@192.168.0.242 "cd /home/henry/Services/hundkrets && export VITE_POCKETBASE_URL=http://localhost:8099 && docker compose up -d"

echo "✅ Deployed successfully!"
echo "📱 Access at: http://192.168.0.242:3123"
