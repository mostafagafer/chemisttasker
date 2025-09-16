#!/bin/bash
# Install system libraries required by WeasyPrint
apt-get update && apt-get install -y \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 libffi-dev shared-mime-info \
    libxml2 libxslt1.1 fonts-liberation

# Activate virtualenv
source venv/bin/activate

# Optional: Debug info
echo "Using Python: $(which python)"
echo "Using Honcho: $(which honcho)"
echo "Procfile:"
cat Procfile

# Start processes using Procfile
exec honcho start
