# client_profile/storage_backends.py

from storages.backends.azure_storage import AzureStorage
from azure.core.exceptions import ResourceNotFoundError

class OverwriteAzureStorage(AzureStorage):
    """
    Always delete the blob first if it exists, so we get a true overwrite.
    """
    def _save(self, name, content):
        # Try to delete an existing blob
        try:
            self.client.delete_blob(self.azure_container, name)
        except ResourceNotFoundError:
            pass  # nothing to delete
        # Now save/upload as normal
        return super()._save(name, content)
