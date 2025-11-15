from pathlib import Path
import os
from environ import Env
from datetime import timedelta
import dj_database_url
import sys



env = Env()
Env.read_env(Path(__file__).resolve().parent / ".env.local")
# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ['*']

# Only send cookies when they’re on an explicitly allowed origin:
CORS_ALLOW_CREDENTIALS = True

# Development: trust your Vite/Expo local ports
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:5176",
    "http://127.0.0.1:5176",
    "http://localhost:19006",
    "http://127.0.0.1:19006",
    "http://192.168.1.7:19006",       # Expo Go dev server
    "exp://192.168.1.7:8081",        # Sometimes Expo uses exp:// protocol
    "http://localhost:8081",        # Your Django server (for completeness)
]

CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

FRONTEND_BASE_URL = "http://localhost:5173"

BACKEND_BASE_URL = "http://127.0.0.1:8000"

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# Application definition
INSTALLED_APPS = [

    'daphne',

    'django.contrib.admin',
    # Async tasks
    'django_q',

    "users.apps.UsersConfig",
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'drf_spectacular',
    'corsheaders',

    # Azure blob
    'storages',

    # my apps
    "client_profile.apps.ClientProfileConfig",

    # Realtime
    'channels',


]


Q_CLUSTER = {
    'name': 'DjangoQ',
    'workers': 4,
    'timeout': 300,
    'retry': 400,
    'queue_limit': 50,
    'bulk': 10,
    'orm': 'default',
}


MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

AUTH_USER_MODEL = 'users.User'

AUTHENTICATION_BACKENDS = [
     'users.authentication.EmailBackend',
     'django.contrib.auth.backends.ModelBackend',
]

REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50
}

# Spectacular
SPECTACULAR_SETTINGS = {
    'TITLE': 'Pharmacy Job Platform API',
    'DESCRIPTION': 'API for a two-sided job platform connecting pharmacy owners and pharmacists',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False
    }

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            os.path.join(BASE_DIR, "templates"),

        ],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.1/ref/settings/#databases

DATABASES = {
    'default': dj_database_url.config(
        default=env('AZURE_POSTGRESQL_CONNECTIONSTRING'),
        conn_max_age=600,
        conn_health_checks=True,
        ssl_require=True
    )
}


# Password validation
# https://docs.djangoproject.com/en/5.1/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.1/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Australia/Sydney'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.1/howto/static-files/

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'

# Default primary key field type
# https://docs.djangoproject.com/en/5.1/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# JWT settings for better frontend integration
SIMPLE_JWT = {
    # Short‑lived access token
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    # Longer‑lived refresh token
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    # Issue a new refresh token each time /refresh/ is called
    'ROTATE_REFRESH_TOKENS': True,
    # Blacklist old refresh tokens—prevents reuse
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'ALGORITHM': 'HS256',
}

# # # tell Django to use Azure for all FileField / ImageField storage
# STORAGES = {
#     # 1) All your FileField / ImageField uploads go here
#     "default": {
#         "BACKEND": "storages.backends.azure_storage.AzureStorage",
#         "OPTIONS": {
#             # Authentication
#             "account_name":    env("AZURE_ACCOUNT_NAME"),
#             "account_key":     env("AZURE_ACCOUNT_KEY"),
#             "azure_container": env("AZURE_CONTAINER"),

#             # Enforce HTTPS when talking to Azure
#             "azure_ssl":       True,           
#             # Overwrite any existing blob with the same name
#             "overwrite_files": True,            
#             # Generate time-limited SAS URLs for users to download
#             "expiration_secs": 3600,            # 1 hour (adjust as you like)

#             # In case of network slowness, bump this up (defaults to None)
#             # "timeout":        120,
#         },
#     },

#     # 2) Tell Django “staticfiles” is still the local/WhiteNoise pipeline
#     "staticfiles": {
#         "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
#     },
# }

# # # Tell Django how to generate media URLs
# MEDIA_URL = (
#     f"https://{env('AZURE_ACCOUNT_NAME')}"
#     f".blob.core.windows.net/{env('AZURE_CONTAINER')}/"
# )

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')


# # Use console backend for local testing
# EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
# DEFAULT_FROM_EMAIL = 'no-reply@localhost'


LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[%(levelname)s %(asctime)s %(process)d] %(name)s %(message)s',
            'datefmt': "%Y-%m-%d %H:%M:%S",
        },
        'simple': {
            'format': '[%(levelname)s] %(name)s: %(message)s'
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
            'stream': sys.stdout,
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'django_q': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        # Your app modules
        'client_profile': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False, 
        },
        'users': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False, 
        },
    }
}


EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.zoho.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = env('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD')
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL')


# Twilio Settings
TWILIO_ACCOUNT_SID = env('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = env('TWILIO_AUTH_TOKEN')

# RECAPTCHA
RECAPTCHA_SECRET_KEY = env('RECAPTCHA_SECRET_KEY')

AZURE_OCR_ENDPOINT=env('AZURE_OCR_ENDPOINT')
AZURE_OCR_KEY=env('AZURE_OCR_KEY')

SCRAPINGBEE_API_KEY=env('SCRAPINGBEE_API_KEY')


# MobileMessage SMS Settings
MOBILEMESSAGE_USERNAME = env('MOBILEMESSAGE_USERNAME')
MOBILEMESSAGE_PASSWORD = env('MOBILEMESSAGE_PASSWORD')
MOBILEMESSAGE_SENDER = env('MOBILEMESSAGE_SENDER')


# ---------------------------------------------------------------------
# Channels (ASGI) configuration
# ---------------------------------------------------------------------
ASGI_APPLICATION = "core.asgi.application"

# Use a single REDIS_URL env var everywhere
# Examples:
#   Local dev (Docker): redis://127.0.0.1:6379/0
#   Azure Cache for Redis (TLS): rediss://:<PASSWORD>@<NAME>.redis.cache.windows.net:6380/0
from environ import Env
env = Env()

REDIS_URL = env("REDIS_URL", default="redis://127.0.0.1:6379/0")

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            # channels_redis accepts URLs with redis:// or rediss:// (TLS)
            "hosts": [REDIS_URL],
            # Keep queues short so idle rooms disappear instead of piling up in Redis.
            "capacity": 100,
            "channel_capacity": {"*": 50},
            "expiry": 30,
            "group_expiry": 60,
        },
    }
}
