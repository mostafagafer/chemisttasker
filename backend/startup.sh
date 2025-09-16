#!/bin/bash
set -e

# Install system dependencies for WeasyPrint
apt-get update && apt-get install -y \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 libffi-dev shared-mime-info \
    libxml2 libxslt1.1 fonts-liberation

# Move to app root (wwwroot)
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "[startup] Python version: $(python --version)"
echo "[startup] Honcho path: $(command -v honcho || echo 'not found')"
echo "[startup] Starting app using honcho and Procfile..."

if [ -f Procfile ]; then
    cat Procfile
else
    echo "[startup] Procfile not found!"
    exit 1
fi

exec python -m honcho start 2>&1 | tee /home/LogFiles/honcho.log
