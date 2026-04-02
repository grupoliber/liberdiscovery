"""
LiberDiscovery - Router: Topologia
Endpoints para mapas de rede e topologia via Zabbix.
"""

from fastapi import APIRouter

from app.services.zabbix_client import zabbix
from app.services.cache import cache

router = APIRouter()


@router.get("/topology/maps")
async def list_maps():
    """Lista mapas de rede disponíveis no Zabbix."""
    cached = await cache.get("topology:maps")
    if cached:
        return cached

    maps = await zabbix.get_maps()
    await cache.set("topology:maps", maps, ttl=120)
    return maps


@router.get("/topology/maps/{map_id}")
async def get_map(map_id: str):
    """Retorna um mapa de rede específico com elementos e links."""
    cached = await cache.get(f"topology:map:{map_id}")
    if cached:
        return cached

    map_data = await zabbix.get_map(map_id)
    await cache.set(f"topology:map:{map_id}", map_data, ttl=60)
    return map_data
