"""
LiberDiscovery - Cache Service
Cache Redis para reduzir chamadas à Zabbix API.
"""

import json
import redis.asyncio as redis

from app.core.config import settings


class CacheService:
    """Serviço de cache com Redis."""

    def __init__(self):
        self.redis: redis.Redis | None = None
        self.default_ttl = settings.cache_ttl

    async def connect(self):
        """Conecta ao Redis."""
        self.redis = redis.from_url(settings.redis_url, decode_responses=True)

    async def disconnect(self):
        """Desconecta do Redis."""
        if self.redis:
            await self.redis.close()

    async def get(self, key: str) -> dict | list | None:
        """Retorna valor do cache."""
        if not self.redis:
            return None
        data = await self.redis.get(f"ld:{key}")
        return json.loads(data) if data else None

    async def set(self, key: str, value: dict | list, ttl: int | None = None):
        """Armazena valor no cache."""
        if not self.redis:
            return
        await self.redis.set(
            f"ld:{key}",
            json.dumps(value, default=str),
            ex=ttl or self.default_ttl,
        )

    async def delete(self, key: str):
        """Remove chave do cache."""
        if self.redis:
            await self.redis.delete(f"ld:{key}")

    async def flush_pattern(self, pattern: str):
        """Remove todas as chaves que correspondem ao pattern."""
        if not self.redis:
            return
        keys = []
        async for key in self.redis.scan_iter(f"ld:{pattern}"):
            keys.append(key)
        if keys:
            await self.redis.delete(*keys)


# Singleton
cache = CacheService()
