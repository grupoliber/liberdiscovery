"""
LiberDiscovery - Router: Dispositivos
Endpoints para gerenciamento de hosts/dispositivos via Zabbix.
"""

from fastapi import APIRouter, Query

from app.services.zabbix_client import zabbix
from app.services.cache import cache

router = APIRouter()


@router.get("/devices")
async def list_devices(
    group_id: str | None = Query(None, description="Filtrar por grupo"),
    limit: int = Query(100, ge=1, le=1000),
):
    """Lista dispositivos monitorados."""
    cache_key = f"devices:list:{group_id}:{limit}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    group_ids = [group_id] if group_id else None
    hosts = await zabbix.get_hosts(group_ids=group_ids, limit=limit)
    await cache.set(cache_key, hosts)
    return hosts


@router.get("/devices/groups")
async def list_device_groups():
    """Lista grupos de dispositivos."""
    cached = await cache.get("devices:groups")
    if cached:
        return cached

    groups = await zabbix.get_host_groups()
    await cache.set("devices:groups", groups, ttl=60)
    return groups


@router.get("/devices/{host_id}")
async def get_device(host_id: str):
    """Retorna detalhes de um dispositivo."""
    cached = await cache.get(f"devices:{host_id}")
    if cached:
        return cached

    host = await zabbix.get_host(host_id)
    await cache.set(f"devices:{host_id}", host)
    return host
