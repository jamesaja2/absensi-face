# Absensi Facial Recognition System — Deployment Script
# Run this ONCE on the server to deploy the full stack.
# Usage: bash deploy.sh

set -euo pipefail

DEPLOY_DIR="$HOME/absensi-system"
REPO_SOURCE="$(pwd)"

echo "=== Absensi Deployment Script ==="
echo "Deploying to: $DEPLOY_DIR"
echo ""

# ─── 1. Create directory structure ───────────────────────────────────────────
mkdir -p "$DEPLOY_DIR/backend/src/routes"
mkdir -p "$DEPLOY_DIR/backend/src/services"
mkdir -p "$DEPLOY_DIR/backend/src/middleware"
mkdir -p "$DEPLOY_DIR/data"
mkdir -p "$DEPLOY_DIR/backend/uploads"
mkdir -p "$DEPLOY_DIR/logs"

# ─── 2. Copy backend files ────────────────────────────────────────────────────
echo "[1/4] Copying backend files..."
cp -r backend/ "$DEPLOY_DIR/"

# Create .env from example if it doesn't exist
if [ ! -f "$DEPLOY_DIR/backend/.env" ]; then
  cp "$DEPLOY_DIR/backend/.env.example" "$DEPLOY_DIR/backend/.env"
  echo "[INFO] Created .env from .env.example — please update COMPREFACE_API_KEY"
fi

# ─── 3. Copy frontend files ───────────────────────────────────────────────────
echo "[2/4] Copying frontend files..."
cp -r frontend/ "$DEPLOY_DIR/"

# ─── 4. Copy deployment files ────────────────────────────────────────────────
echo "[3/4] Copying deployment files..."
cp docker-compose.override.yml "$DEPLOY_DIR/"
cp start.sh "$DEPLOY_DIR/"
cp absensi.service "$DEPLOY_DIR/"
chmod +x "$DEPLOY_DIR/start.sh"

# ─── 5. Ensure Docker network exists ─────────────────────────────────────────
echo "[4/4] Ensuring Docker network exists..."
docker network inspect absensi_net > /dev/null 2>&1 || docker network create absensi_net

# ─── 6. Build Docker images ───────────────────────────────────────────────────
echo ""
echo "Building Docker images (this may take several minutes)..."
cd "$DEPLOY_DIR"
docker compose -f docker-compose.yml -f docker-compose.override.yml build backend_absensi frontend_absensi

# ─── 7. Start all services ────────────────────────────────────────────────────
echo ""
echo "Starting all services..."
bash start.sh

echo ""
echo "===== Deployment Complete ====="
echo ""
echo "  Kiosk UI:       http://192.168.100.52:3000"
echo "  Admin Login:    http://192.168.100.52:3000/admin"
echo "  Backend API:    http://192.168.100.52:3001/api/health"
echo ""
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "IMPORTANT: Change ADMIN_PASSWORD in docker-compose.override.yml before going live!"
echo ""
echo "To enable auto-start on boot:"
echo "  sudo cp absensi.service /etc/systemd/system/"
echo "  sudo systemctl enable absensi"
echo "  sudo systemctl start absensi"
