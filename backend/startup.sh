#!/bin/bash
set -e

# Go to the application's root directory
cd "$(dirname "${BASH_SOURCE[0]}")"

# STEP 1: (NO SSH NEEDED) Clean up old packages to prevent conflicts.
echo "[startup] Wiping old .python_packages directory to ensure a clean start..."
rm -rf /home/site/wwwroot/.python_packages

# STEP 2: Install all necessary OS-level dependencies.
echo "[startup] Installing system packages for build tools, Pillow, and WeasyPrint..."
apt-get update && apt-get install -y \
  # Build tools for compiling packages
  build-essential libssl-dev libffi-dev python3-dev \
  # Pillow dependencies
  libjpeg-dev zlib1g-dev \
  # WeasyPrint dependencies
  libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
  libgdk-pixbuf2.0-0 shared-mime-info \
  libxml2 libxslt1.1 fonts-liberation

# STEP 3: Install Python packages, building incompatible ones from source.
echo "[startup] Installing Python dependencies and building cryptography from source..."
pip install --upgrade pip
# The --no-binary flag forces cryptography to compile on the server, avoiding GLIBC errors.
pip install --no-binary cryptography -r requirements.txt

# STEP 4: Run Django commands.
echo "[startup] Running database migrations..."
python manage.py migrate --noinput

echo "[startup] Collecting static files..."
python manage.py collectstatic --noinput

# STEP 5: Start the application.
echo "[startup] Starting application with Honcho..."
exec honcho start