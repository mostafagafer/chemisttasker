#!/bin/bash
set -e

# 0) Go to app root (wwwroot after unzip)
cd "$(dirname "${BASH_SOURCE[0]}")"
echo "[startup] PWD: $(pwd)"
echo "[startup] Python version: $(python --version)"

# 1) (Optional) OS deps your app needs (WeasyPrint etc.)
apt-get update && apt-get install -y \
  libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
  libgdk-pixbuf2.0-0 libffi-dev shared-mime-info \
  libxml2 libxslt1.1 fonts-liberation

# 2) Ensure site-packages target location exists
SITE_PKGS="/home/site/wwwroot/.python_packages/lib/site-packages"
mkdir -p "$SITE_PKGS"

# 3) If a previous deploy left bad wheels, hard-override them here
#    (no venv; install straight into App Service site-packages)
echo "[startup] Ensuring GLIBC-safe crypto wheels..."
python -m pip install --upgrade pip
python -m pip install --no-cache-dir --upgrade \
  --target "$SITE_PKGS" "cryptography==41.0.7" "pyOpenSSL==23.2.0"

# 4) If first boot (no Django installed), install all deps to .python_packages
if [ ! -d "$SITE_PKGS/django" ]; then
  echo "[startup] Installing requirements into .python_packages..."
  python -m pip install --no-cache-dir --upgrade \
    --target "$SITE_PKGS" -r requirements.txt
fi

# 5) Run Django DB tasks
echo "[startup] Running migrations..."
python manage.py migrate --noinput

echo "[startup] Collecting static files..."
python manage.py collectstatic --noinput

# 6) Start processes from Procfile (Daphne + qcluster)
echo "[startup] Honcho path: $(command -v honcho || echo 'not found')"
echo "[startup] Procfile:"
cat Procfile || { echo "[startup] Procfile missing!"; exit 1; }

exec python -m honcho start 2>&1 | tee /home/LogFiles/honcho.log
