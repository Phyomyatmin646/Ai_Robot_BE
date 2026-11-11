#!/bin/bash
# =================================================================
# AWS EC2 Deployment Script for AI Voice Assistant Robot Platform
# Target OS: Ubuntu 22.04 LTS / 24.04 LTS
# =================================================================

set -e

echo "🚀 Starting AI Robot Platform EC2 Deployment..."

# 1. Update and install prerequisites
sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release git

# 2. Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

# 3. Install Docker Compose plugin
sudo apt-get install -y docker-compose-plugin

# 4. Clone / Pull Repository
if [ ! -d "/opt/ai-robot-platform" ]; then
    echo "Cloning repository..."
    sudo git clone https://github.com/your-org/ai-robot-platform.git /opt/ai-robot-platform
    sudo chown -R $USER:$USER /opt/ai-robot-platform
fi

cd /opt/ai-robot-platform

# 5. Check environment configuration
if [ ! -f ".env" ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️ Please edit /opt/ai-robot-platform/.env with your production credentials."
fi

# 6. Deploy containers
echo "Starting production containers with Docker Compose..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml down --remove-orphans || true
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

# 7. Check container status
docker compose ps

echo "✅ Deployment completed successfully!"
echo "Check logs with: docker compose logs -f"

