#!/bin/bash
# Install system libraries required by WeasyPrint
apt-get update && apt-get install -y \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 libffi-dev shared-mime-info \
    libxml2 libxslt1.1 fonts-liberation

# Activate the virtual environment
source venv/bin/activate

# OPTIONAL: Log python path for debugging
echo "Python path: $(which python)"
echo "Daphne path: $(which daphne)"

# Start Django Q cluster in background
python manage.py qcluster &

# Start Daphne in foreground (main web process)
exec daphne -b 0.0.0.0 -p 8000 core.asgi:application
