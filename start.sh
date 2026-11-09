#!/usr/bin/env bash
# =============================================================================
# start.sh — Absensi System Startup Script (Optimized & Bloat-Free)
# Starts GPU-accelerated CompreFace and Web App (Backend + Frontend).
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/startup.log"

# ─── Ensure directories exist ─────────────────────────────────────────────────
mkdir -p "$SCRIPT_DIR/logs"
mkdir -p "$SCRIPT_DIR/data"
mkdir -p "$SCRIPT_DIR/backend/uploads"
mkdir -p "$SCRIPT_DIR/backend/models"

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

# ─── Start CompreFace (GPU instance) ─────────────────────────────────────────
if [ -d "$SCRIPT_DIR/compreface" ]; then
  echo "[INFO] Ensuring CompreFace GPU stack is running..." | tee -a "$LOG_FILE"
  (cd "$SCRIPT_DIR/compreface" && docker compose up -d 2>&1) | tee -a "$LOG_FILE"
fi

cd "$SCRIPT_DIR"

# ─── Start Web App (Backend with Anti-Spoofing + Frontend Next.js) ────────────
echo "[INFO] Starting Absensi Web App (Backend + Frontend)..." | tee -a "$LOG_FILE"
docker compose -f docker-compose.override.yml up -d --remove-orphans 2>&1 | tee -a "$LOG_FILE"

# ─── Show status ──────────────────────────────────────────────────────────────
echo "" | tee -a "$LOG_FILE"
echo "[INFO] Services started successfully. Container status:" | tee -a "$LOG_FILE"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "─────────────────────────────────────────────────────────────" | tee -a "$LOG_FILE"
echo "  🌐 Frontend (Kiosk):    http://192.168.100.52:8080" | tee -a "$LOG_FILE"
echo "  🔧 Backend API:         http://192.168.100.52:3001/api/health" | tee -a "$LOG_FILE"
echo "  🔐 Admin Dashboard:     http://192.168.100.52:8080/admin" | tee -a "$LOG_FILE"
echo "  🧠 CompreFace GPU:      http://192.168.100.52:8000" | tee -a "$LOG_FILE"
echo "  🛡️ Anti-Spoofing:       Active (MiniFASNetV2)" | tee -a "$LOG_FILE"
echo "─────────────────────────────────────────────────────────────" | tee -a "$LOG_FILE"
