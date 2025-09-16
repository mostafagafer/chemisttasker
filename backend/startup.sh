#!/bin/bash
set -e

# OS packages for WeasyPrint
apt-get update && apt-get install -y \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 libffi-dev shared-mime-info \
    libxml2 libxslt1.1 fonts-liberation

# Enter app root (after unzip, Azure lands in /home/site/wwwroot)
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "[startup] Python version: $(python --version)"
echo "[startup] Honcho path: $(command -v honcho || echo 'not found')"
echo "[startup] Starting app using honcho and Procfile..."
cat Procfile || echo "[startup] Procfile missing!"

# Reinstall GLIBC-safe crypto packages (to fix cryptography crash)
echo "[startup] Reinstalling cryptography and pyOpenSSL to avoid GLIBC_2.33 crash"
pip uninstall -y cryptography pyOpenSSL || true
pip install --no-cache-dir "cryptography==41.0.7" "pyOpenSSL==23.2.0"

# Run DB migrations & collectstatic
echo "[startup] Running DB migrations..."
python manage.py migrate --noinput

echo "[startup] Collecting static files..."
python manage.py collectstatic --noinput

# Start using honcho (Procfile)
exec python -m honcho start 2>&1 | tee /home/LogFiles/honcho.log
