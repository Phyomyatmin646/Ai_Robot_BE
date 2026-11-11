# Production Deployment Guide: AWS EC2

This guide outlines deploying the production AI Voice Assistant Robot Platform backend onto an **AWS EC2 Ubuntu Instance** using Docker Compose and Nginx with SSL.

---

## 1. Instance Recommendation

- **AWS EC2 Instance Type:** `t3.medium` or `t3.large` (2 vCPU, 4–8 GB RAM).
- **OS:** Ubuntu 22.04 LTS / 24.04 LTS (x86_64 or arm64).
- **Storage:** 40 GB+ gp3 EBS Volume.
- **Security Group Inbound Rules:**
  - Port `22` (SSH) — Restricted to administrator IP.
  - Port `80` (HTTP) — `0.0.0.0/0` (Redirects to HTTPS).
  - Port `443` (HTTPS & WSS) — `0.0.0.0/0`.
  - Port `1883` (MQTT) — `0.0.0.0/0` (For ESP32 IoT connectivity).
  - *Never expose port 27017 (MongoDB) or 6379 (Redis) publicly.*

---

## 2. Automated One-Click Deployment

1. SSH into your newly launched EC2 instance:
   ```bash
   ssh -i your-key.pem ubuntu@ec2-xx-xx-xx-xx.compute-1.amazonaws.com
   ```

2. Download and run the automated deployment script:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/your-org/ai-robot-platform/main/infrastructure/scripts/deploy-ec2.sh | bash
   ```

---

## 3. Configuring Secrets (`.env`)

Edit `/opt/ai-robot-platform/.env`:
```bash
nano /opt/ai-robot-platform/.env
```
Fill in the production values:
- `JWT_SECRET`: Generate a 64-character random string (`openssl rand -hex 32`).
- `GEMINI_API_KEY`: Your Google Gemini API key.
- `TELEGRAM_BOT_TOKEN`: Token obtained from `@BotFather`.
- `MONGODB_URI`: Leave default to use local container MongoDB or supply MongoDB Atlas URI.

---

## 4. Setting up SSL with Let's Encrypt Certbot

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

Certbot will automatically configure HTTPS certificates and autorenewal timers.

---

## 5. Verification & Health Monitoring

```bash
# Check container status
docker compose ps

# Check backend health
curl -f https://api.yourdomain.com/health

# View live system logs
docker compose logs -f backend
```

