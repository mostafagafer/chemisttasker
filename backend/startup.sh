#!/bin/bash
set -e

# OS packages for WeasyPrint
apt-get update && apt-get install -y \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 libffi-dev shared-mime-info \
    libxml2 libxslt1.1 fonts-liberation

# Always cd to the folder where this script lives (wwwroot after unzip)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 🔧 ACTIVATE VIRTUAL ENVIRONMENT
if [ -f "$SCRIPT_DIR/antenv/bin/activate" ]; then
    echo "[startup] Activating virtualenv..."
    source "$SCRIPT_DIR/antenv/bin/activate"
else
    echo "[startup] Virtualenv not found at antenv/bin/activate"
    exit 1
fi

# Debug info
echo "[startup] PWD: $(pwd)"
echo "[startup] Listing wwwroot:"
ls -la
echo "[startup] Python version: $(python --version)"
echo "[startup] Python path: $(which python)"
echo "[startup] Honcho: $(command -v honcho || echo 'not found')"
echo "[startup] Procfile contents:"
cat Procfile || echo "[startup] Procfile missing!"

# --- Minimal hotfix: ensure GLIBC-compatible cryptography in Azure runtime ---
echo "[startup] Enforcing GLIBC-safe crypto wheels..."
python - <<'PY'
import sys
try:
    import cryptography
    v = cryptography.__version__
    print(f"[startup] cryptography detected: {v}")
    sys.exit(0 if v in ("43.0.3","41.0.7") else 1)
except Exception as e:
    print(f"[startup] cryptography import failed: {e}")
    sys.exit(1)
PY
if [ $? -ne 0 ]; then
  echo "[startup] Reinstalling cryptography 43.0.3 into site-packages..."
  python -m pip install --no-cache-dir --force-reinstall "cryptography==43.0.3" "pyOpenSSL==24.2.1"
fi
# --- End hotfix ---

# 🔁 Start app using Procfile via honcho
exec python -m honcho start 2>&1 | tee /home/LogFiles/honcho.log
