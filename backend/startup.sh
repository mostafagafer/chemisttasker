#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "[startup] Python version: $(python --version)"
echo "[startup] Installing requirements..."
pip install --upgrade pip
pip install -r requirements.txt

echo "[startup] Running DB migrations..."
python manage.py migrate --noinput

echo "[startup] Collecting static files..."
python manage.py collectstatic --noinput

echo "[startup] Starting honcho with Procfile..."
cat Procfile || echo "[startup] Procfile missing!"

exec python -m honcho start 2>&1 | tee /home/LogFiles/honcho.log
