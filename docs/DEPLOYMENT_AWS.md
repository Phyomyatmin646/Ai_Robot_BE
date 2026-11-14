# Production Deployment Guide: AWS EC2 & GitHub CI/CD

This guide provides complete instructions for deploying the simplified, lightweight **AI Robot Backend Platform** onto an **AWS EC2 Ubuntu Instance (~2GB RAM)** with automated **GitHub Actions CI/CD**.

---

## 1. AWS EC2 Instance & Security Group Configuration

- **Instance Type:** `t3.small`, `t4g.small`, or `t3a.small` (2 vCPU, 2 GB RAM).
- **OS:** Ubuntu 22.04 LTS or 24.04 LTS (x86_64 or arm64).
- **Storage:** 20 GB+ gp3 EBS Volume.
- **Inbound Security Group Rules:**
  - **Port `22` (SSH)**: Your IP or `0.0.0.0/0` (for GitHub Actions SSH deployment).
  - **Port `3000` (Custom TCP)**: `0.0.0.0/0` (Fastify REST API, ESP32 WebSocket `/ws/esp32`, and Dashboard Socket.IO `/socket.io/`).
  - *(Note: Port 6379 Redis is bound to `127.0.0.1` locally and is NEVER exposed to the public internet).*

---

## 2. Initial One-Time Setup on AWS EC2

1. **SSH into your EC2 instance:**
   ```bash
   ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
   ```

2. **Clone the repository:**
   ```bash
   git clone https://github.com/Phyomyatmin646/Ai_Robot_BE.git ~/Ai_Robot_BE
   cd ~/Ai_Robot_BE
   ```

3. **Configure Environment Variables (`.env`):**
   ```bash
   cp .env.example .env
   nano .env
   ```
   Provide your real credentials:
   - `MONGODB_URI`: Your MongoDB Atlas connection string (`mongodb+srv://...`).
   - `GEMINI_API_KEY`: Your Google Gemini API key.
   - `JWT_SECRET`: A secure random secret string.
   - `FAST_MODEL`: `gemini-3.5-flash-lite`
   - `VOICE_MODEL`: `gemini-3.8-live`
   - `CORS_ORIGINS`: Include your frontend URL (e.g. `http://localhost:5173`, `http://<EC2_IP>:5173`, etc.)

4. **Run the Automated EC2 Deployment Script:**
   ```bash
   chmod +x infrastructure/scripts/deploy-ec2.sh
   ./infrastructure/scripts/deploy-ec2.sh
   ```
   *This script automatically allocates a 2GB swapfile (preventing OOM during Docker build), installs Docker if missing, starts the containers with production memory limits, and verifies `/health`.*

---

## 3. GitHub Actions CI/CD Setup

Whenever you push to `master` (or click "Run workflow" in GitHub Actions), GitHub Actions will automatically:
1. Run TypeScript build and unit tests.
2. Verify Python AI services syntax and dependencies.
3. SSH into your EC2 instance, pull the latest code, and deploy with zero downtime.

### Required GitHub Repository Secrets
Go to your GitHub repository:
**Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**:

| Secret Name | Description | Example Value |
| :--- | :--- | :--- |
| `EC2_HOST` | EC2 Public IP or Public DNS | `3.106.xxx.xxx` |
| `EC2_USER` | EC2 SSH Username | `ubuntu` |
| `EC2_SSH_KEY` | Entire private key (`.pem` file) | `-----BEGIN RSA PRIVATE KEY----- ...` |
| `EC2_PROJECT_PATH` | Path where repo is cloned on EC2 | `/home/ubuntu/Ai_Robot_BE` *(optional, default)* |

---

## 4. Verification & Management on EC2

```bash
# Check container status
docker compose ps

# Check backend health
curl http://127.0.0.1:3000/health

# View live container logs
docker compose logs -f backend

# Stop all services
docker compose down
```

