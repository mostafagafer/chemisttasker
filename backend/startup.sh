#!/bin/bash
set -e

apt-get update && apt-get install -y \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 libffi-dev shared-mime-info \
    libxml2 libxslt1.1 fonts-liberation

cd "$(dirname "${BASH_SOURCE[0]}")"

echo "[startup] Python version: $(python --version)"
echo "[startup] Honcho: $(command -v honcho || echo 'not found')"
echo "[startup] Starting app via honcho with Procfile..."
cat Procfile || echo "[startup] Procfile missing!"

exec python -m honcho start 2>&1 | tee /home/LogFiles/honcho.log
