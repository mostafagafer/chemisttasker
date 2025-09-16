#!/bin/bash
set -e

# OS packages for WeasyPrint
apt-get update && apt-get install -y \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 libffi-dev shared-mime-info \
    libxml2 libxslt1.1 fonts-liberation

# Always cd to the folder where this script lives (i.e., wwwroot after unzip)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Debug info
echo "[startup] PWD: $(pwd)"
echo "[startup] Listing wwwroot:"
ls -la

# Activate venv if present (you zip it into backend/)
if [ -f "venv/bin/activate" ]; then
  source venv/bin/activate
  echo "[startup] Python: $(which python)"
else
  echo "[startup] WARNING: venv/bin/activate not found; continuing without venv"
fi

# Show Procfile + honcho path
echo "[startup] Honcho: $(command -v honcho || echo 'not found')"
echo "[startup] Procfile contents:"
cat Procfile || echo "[startup] Procfile missing!"

# Pipe output to a log so you can inspect failures in /home/LogFiles
exec python -m honcho start 2>&1 | tee /home/LogFiles/honcho.log
