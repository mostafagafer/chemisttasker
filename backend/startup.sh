#!/bin/bash
set -e

# Go to the application's root directory
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "[startup] Installing system packages..."
apt-get update && apt-get install -y \
  libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
  libgdk-pixbuf2.0-0 libffi-dev shared-mime-info \
  libxml2 libxslt1.1 fonts-liberation

echo "[startup] Installing Python dependencies and building cryptography from source..."
pip install --upgrade pip

# THIS IS THE FIX: The --no-binary flag forces this package to be compiled on the server.
pip install --no-binary cryptography -r requirements.txt

echo "[startup] Running database migrations..."
python manage.py migrate --noinput

echo "[startup] Collecting static files..."
python manage.py collectstatic --noinput

echo "[startup] Starting application with Honcho..."
exec honcho start