#!/bin/bash
set -e

# Install OS packages needed for WeasyPrint
apt-get update && apt-get install -y \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 libffi-dev shared-mime-info \
    libxml2 libxslt1.1 fonts-liberation

# Always cd to the folder where this script lives (wwwroot after unzip)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 🔧 Activate virtual environment (created by your GitHub Action)
if [ -f "$SCRIPT_DIR/antenv/bin/activate" ]; then
    echo "[startup] Activating virtualenv..."
    source "$SCRIPT_DIR/antenv/bin/activate"
else
    echo "[startup] Virtualenv not found at antenv/bin/activate"
    exit 1
fi

# ✅ Debug info
echo "[startup] Python version: $(python --version)"
echo "[startup] Honcho: $(command -v honcho || echo 'not found')"
echo "[startup] Starting app via honcho with Procfile..."
cat Procfile || echo "[startup] Procfile missing!"

# 🚀 Start app using honcho and Procfile
exec python -m honcho start 2>&1 | tee /home/LogFiles/honcho.log
