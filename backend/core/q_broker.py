from django.conf import settings
from django_q.brokers.redis_broker import Redis


class LowCommandRedis(Redis):
    def dequeue(self):
        timeout = int(getattr(settings, "Q_REDIS_BLPOP_TIMEOUT", 1))
        task = self.connection.blpop(self.list_key, timeout)
        if task:
            return [(None, task[1])]
        return None
