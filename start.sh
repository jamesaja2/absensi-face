#!/usr/bin/env bash
# =============================================================================
# start.sh — Absensi System Startup Script
# Starts all infrastructure AND web app containers on boot.
#
# Usage:
#   chmod +x start.sh
#   ./start.sh          # manual start
#
# To enable auto-start on boot:
#   sudo cp absensi.service /etc/systemd/system/
#   sudo systemctl enable absensi
#   sudo systemctl start absensi
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/startup.log"

# ─── Ensure directories exist ─────────────────────────────────────────────────
mkdir -p "$SCRIPT_DIR/logs"
mkdir -p "$SCRIPT_DIR/data"
mkdir -p "$SCRIPT_DIR/backend/uploads"

echo "" | tee -a "$LOG_FILE"
echo "============================================================" | tee -a "$LOG_FILE"
echo "  Absensi System — Starting $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
echo "============================================================" | tee -a "$LOG_FILE"

# ─── Check Docker is running ──────────────────────────────────────────────────
if ! docker info > /dev/null 2>&1; then
  echo "[ERROR] Docker is not running. Please start Docker first." | tee -a "$LOG_FILE"
  exit 1
fi

# ─── Ensure the Docker network exists ────────────────────────────────────────
if ! docker network inspect absensi_net > /dev/null 2>&1; then
  echo "[INFO] Creating Docker network: absensi_net" | tee -a "$LOG_FILE"
  docker network create absensi_net
fi

cd "$SCRIPT_DIR"

# ─── Pull latest images (optional — comment out for offline) ─────────────────
# echo "[INFO] Pulling latest images..." | tee -a "$LOG_FILE"
# docker compose pull

# ─── Start infrastructure stack ───────────────────────────────────────────────
echo "[INFO] Starting infrastructure (Frigate, Double-Take, CompreFace, Mosquitto)..." | tee -a "$LOG_FILE"
docker compose up -d 2>&1 | tee -a "$LOG_FILE"

# ─── Wait for Mosquitto to be ready ──────────────────────────────────────────
echo "[INFO] Waiting for Mosquitto to be ready..." | tee -a "$LOG_FILE"
for i in {1..20}; do
  if docker exec mosquitto_absensi mosquitto_pub -h localhost -t "test" -m "ping" > /dev/null 2>&1; then
    echo "[OK] Mosquitto is ready." | tee -a "$LOG_FILE"
    break
  fi
  echo "[INFO] Waiting... ($i/20)" | tee -a "$LOG_FILE"
  sleep 3
done

# ─── Start web app stack ──────────────────────────────────────────────────────
echo "[INFO] Starting web app (Backend + Frontend)..." | tee -a "$LOG_FILE"
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d backend_absensi frontend_absensi 2>&1 | tee -a "$LOG_FILE"

# ─── Show status ──────────────────────────────────────────────────────────────
echo "" | tee -a "$LOG_FILE"
echo "[INFO] All services started. Container status:" | tee -a "$LOG_FILE"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "─────────────────────────────────────────────────────────────" | tee -a "$LOG_FILE"
echo "  🌐 Frontend (Kiosk):  http://192.168.100.52:3000" | tee -a "$LOG_FILE"
echo "  🔧 Backend API:       http://192.168.100.52:3001/api/health" | tee -a "$LOG_FILE"
echo "  🔐 Admin Dashboard:   http://192.168.100.52:3000/admin" | tee -a "$LOG_FILE"
echo "─────────────────────────────────────────────────────────────" | tee -a "$LOG_FILE"
