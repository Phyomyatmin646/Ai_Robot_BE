#!/bin/bash
# =================================================================
# AWS EC2 Deployment Script for AI Voice Assistant Robot Platform
# Optimized for AWS EC2 (~2GB RAM, Ubuntu 22.04 / 24.04 LTS)
# =================================================================

set -e

echo "🚀 Starting AI Robot Platform EC2 Deployment..."

# 1. Ensure Swap Space is configured (Critical for 2GB EC2 instances during Docker build)
SWAP_TOTAL=$(free -m | awk '/Swap:/ {print $2}')
if [ "$SWAP_TOTAL" -lt 1024 ]; then
    echo "⚠️ Low swap detected (${SWAP_TOTAL}MB). Allocating 2GB swap to prevent OOM during Docker build..."
    if [ ! -f /swapfile ]; then
        sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
        echo "✅ 2GB Swapfile activated."
    else
        sudo swapon /swapfile || true
    fi
fi

# 2. Check and Install Docker & Docker Compose if missing
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker "$USER"
    rm get-docker.sh
    echo "Docker installed successfully."
fi

# 3. Navigate to repository root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# 4. Check .env configuration
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "⚠️ .env not found. Creating from .env.example..."
        cp .env.example .env
        echo "⚠️ Please edit $REPO_ROOT/.env with your production credentials (GEMINI_API_KEY, MONGODB_URI, etc.) and rerun."
        exit 1
    else
        echo "❌ .env file missing in $REPO_ROOT! Please provide .env before deploying."
        exit 1
    fi
fi

# 5. Pull latest changes if git repository
if [ -d ".git" ]; then
    echo "Fetching latest changes from Git..."
    git pull origin master || true
fi

# 6. Build and launch production containers with resource limits
echo "Building and starting production containers..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml down --remove-orphans || true
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d --remove-orphans

# 7. Wait and verify health
echo "Verifying service health..."
sleep 10
docker compose ps

# Retry health check up to 6 times (30 seconds)
HEALTH_OK=false
for i in {1..6}; do
    if curl -s http://127.0.0.1:3000/health | grep -q '"status":"ok"'; then
        HEALTH_OK=true
        break
    fi
    echo "Waiting for services to become healthy (attempt $i/6)..."
    sleep 5
done

if [ "$HEALTH_OK" = true ]; then
    echo "✅ System is healthy and operational!"
    curl -s http://127.0.0.1:3000/health
    echo ""
else
    echo "⚠️ Warning: Health check did not return ok within 30 seconds. Inspecting logs:"
    docker compose logs --tail 30
fi

# 8. Clean up dangling images to preserve EC2 disk space
docker image prune -f

echo "🎉 EC2 Deployment completed successfully!"
echo "Backend URL: http://$(curl -s http://checkip.amazonaws.com 2>/dev/null || echo '<EC2_PUBLIC_IP>'):3000"
echo "WebSocket:   ws://$(curl -s http://checkip.amazonaws.com 2>/dev/null || echo '<EC2_PUBLIC_IP>'):3000/ws/esp32"


