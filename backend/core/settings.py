from pathlib import Path
import os
from environ import Env
from datetime import timedelta
import dj_database_url



env = Env()
Env.read_env()
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
    "http://localhost:19006",
    "http://127.0.0.1:19006",
]

CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

FRONTEND_BASE_URL = "http://localhost:5173"


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
    'django.contrib.admin',
    'users',
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

    # Async tasks
    "procrastinate.contrib.django",

    # Azure blob
    'storages',

    # my apps
    'client_profile',
]

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

# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.sqlite3',
#         'NAME': BASE_DIR / 'db.sqlite3',
#     }
# }

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


EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.zoho.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = env('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD')
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL')


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "procrastinate": {
            "format": "%(asctime)s %(levelname)-7s %(name)s %(message)s"
        },
    },
    "handlers": {
        "procrastinate": {
            "level": "DEBUG",
            "class": "logging.StreamHandler",
            "formatter": "procrastinate",
        },
    },
    "loggers": {
        "procrastinate": {
            "handlers": ["procrastinate"],
            "level": "INFO",
            "propagate": False,
        },
    },
}


# # Function to run when the app is ready
# PROCRASTINATE_ON_APP_READY = "myapp.procrastinate.on_app_ready"

# # Module name for auto-discovering tasks (default is "tasks")
# PROCRASTINATE_AUTODISCOVER_MODULE_NAME = "tasks"

# # Additional modules to import tasks from
# PROCRASTINATE_IMPORT_PATHS = ["myapp.extra_tasks"]

# # Database alias to use (default is "default")
# PROCRASTINATE_DATABASE_ALIAS = "default"
