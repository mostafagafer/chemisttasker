#!/bin/bash
set -e

echo "[startup] Setting up system packages..."
apt-get update && apt-get install -y \
  libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
  libgdk-pixbuf2.0-0 libffi-dev shared-mime-info \
  libxml2 libxslt1.1 fonts-liberation

cd "$(dirname "${BASH_SOURCE[0]}")"
echo "[startup] PWD: $(pwd)"

# Step 1: Delete .python_packages to kill off conflicting libs
echo "[startup] Removing old .python_packages (they break GLIBC)..."
rm -rf .python_packages || true

# Step 2: Create clean virtualenv
echo "[startup] Creating virtualenv..."
python -m venv antenv
source antenv/bin/activate

# Step 3: Install dependencies
echo "[startup] Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Step 4: Django setup
echo "[startup] Running migrations..."
python manage.py migrate --noinput

echo "[startup] Collecting static files..."
python manage.py collectstatic --noinput

# Step 5: Run via honcho
echo "[startup] Honcho path: $(which honcho || echo 'not found')"
exec python -m honcho start 2>&1 | tee /home/LogFiles/honcho.log
