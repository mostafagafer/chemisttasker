from django.apps import AppConfig
from django.db.utils import OperationalError, ProgrammingError

class ClientProfileConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'client_profile'
    
    def ready(self):
        """
        This method is called when the app is ready.
        Importing signals here connects the signal handlers.
        """
        import client_profile.signals
        try:
            from .calendar_schedules import ensure_calendar_schedules
            ensure_calendar_schedules()
        except (OperationalError, ProgrammingError):
            # Database might not be ready during migrations or startup.
            pass
