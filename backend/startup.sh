#!/bin/bash
set -e

# Always start in the app root (wwwroot)
cd "$(dirname "${BASH_SOURCE[0]}")"

# --- WeasyPrint system dependencies (required) ---
echo "[startup] Installing system packages for WeasyPrint..."
apt-get update && apt-get install -y \
  build-essential libssl-dev libffi-dev python3-dev \
  libjpeg-dev zlib1g-dev \
  libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
  libgdk-pixbuf2.0-0 shared-mime-info \
  libxml2 libxslt1.1 fonts-liberation

# Hard purge any stale, incompatible wheels from previous deploys
echo "[startup] Purging stale .python_packages to avoid GLIBC mismatch..."
rm -rf /home/site/wwwroot/.python_packages

echo "[startup] Python version: $(python --version)"
echo "[startup] Procfile:"
cat Procfile || echo "[startup] Procfile missing!"

# Run Django management tasks with the environment that Azure built
echo "[startup] Running database migrations..."
python manage.py migrate --noinput || true

echo "[startup] Collecting static files..."
python manage.py collectstatic --noinput || true

# Optional: quick Redis ping for visibility (non-blocking)
if [ -n "$REDIS_URL" ]; then
  echo "[startup] Verifying Redis connectivity..."
  python - <<'PY' || true
import os
try:
    import redis
    redis.from_url(os.environ["REDIS_URL"]).ping()
    print("[startup] Redis reachable.")
except Exception as e:
    print(f"[startup] Redis check failed: {e}")
PY
fi

# Start web + worker via honcho (qcluster delayed via Procfile)
echo "[startup] Starting processes..."
exec python -m honcho start 2>&1 | tee /home/LogFiles/honcho.log
