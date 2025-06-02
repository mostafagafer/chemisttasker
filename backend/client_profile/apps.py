from django.apps import AppConfig


class ClientProfileConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'client_profile'
    def ready(self):
        import client_profile.tasks
