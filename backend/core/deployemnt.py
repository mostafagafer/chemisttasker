import os
from .settings import *
from .settings import BASE_DIR

ALLOWED_HOSTS = [os.environ['WEBSITE_HOSTING']]

CSRF_TRUSTED_ORIGINS = [
    'https://' + os.environ['WEBSITE_HOSTING']
]

CORS_ALLOWED_ORIGINS = [
    'https://' + os.environ['WEBSITE_HOSTING']
]

DEBUG=False

# Redirect all HTTP → HTTPS
SECURE_SSL_REDIRECT = True

# Cookies only over HTTPS
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE    = True

# HSTS (browser “always use HTTPS next time”)
SECURE_HSTS_SECONDS           = 3600
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD           = True

# Protect against some XSS attacks
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS           = 'DENY'

# When behind Azure’s load-balancer
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

SECRET_KEY = os.environ['MY_SECRET_KEY']

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    "whitenoise.middleware.WhiteNoiseMiddleware",
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]


# STORAGES = {
#     "staticfiles": {
#         "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
#     },
# }

CONNECTION = os.environ['AZURE_POSTGRESQL_CONNECTIONSTRING']
CONNECTION_STR = {pair.split('=')[0]:pair.split('=')[1] for pair in CONNECTION.split(' ')}

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": CONNECTION_STR['dbname'],
        "HOST": CONNECTION_STR['host'],
        "USER": CONNECTION_STR['user'],
        "PASSWORD": CONNECTION_STR['password'],
    }
}

STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedStaticFilesStorage"
STATIC_URL = "/static/"

TIME_ZONE = 'Australia/Sydney'
