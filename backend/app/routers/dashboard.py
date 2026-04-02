"""
LiberDiscovery - Router: Dashboard
Endpoints para o dashboard principal.
"""

from fastapi import APIRouter

from app.services.zabbix_client import zabbix
from app.services.cache import cache

router = APIRouter()


@router.get("/dashboard/stats")
async def get_dashboard_stats():
    """Retorna estatísticas gerais para o dashboard."""
    cached = await cache.get("dashboard:stats")
    if cached:
        return cached

    stats = await zabbix.get_dashboard_stats()
    await cache.set("dashboard:stats", stats, ttl=15)
    return stats
