"""
LiberDiscovery - Router: Sensores
Endpoints estilo PRTG para visualização de sensores (items Zabbix).
"""

from fastapi import APIRouter, Query

from app.services.zabbix_client import zabbix
from app.services.cache import cache

router = APIRouter()


@router.get("/sensors/tree")
async def get_sensors_tree():
    """Retorna árvore hierárquica: Grupo > Host > Sensores (estilo PRTG)."""
    cached = await cache.get("sensors:tree")
    if cached:
        return cached

    tree = await zabbix.get_sensors_tree()
    await cache.set("sensors:tree", tree, ttl=20)
    return tree


@router.get("/sensors/{item_id}")
async def get_sensor_detail(item_id: str):
    """Retorna detalhes de um sensor com histórico recente (2h)."""
    detail = await zabbix.get_sensor_detail(item_id)
    return detail


@router.get("/sensors/host/{host_id}")
async def get_host_sensors(
    host_id: str,
    search: str | None = Query(None, description="Buscar por nome"),
):
    """Lista sensores de um host específico, classificados por tipo."""
    from app.services.zabbix_client import _classify_sensors
    items = await zabbix.get_items(host_id, search=search)
    return _classify_sensors(items)


@router.get("/sensors/summary")
async def get_sensors_summary():
    """Retorna resumo geral de sensores (estilo PRTG overview)."""
    cached = await cache.get("sensors:summary")
    if cached:
        return cached

    tree = await zabbix.get_sensors_tree()

    total_groups = len(tree)
    total_hosts = sum(g["host_count"] for g in tree)
    total_sensors = sum(g["sensor_count"] for g in tree)
    total_problems = sum(g["problem_count"] for g in tree)

    # Contar por status
    status_counts = {"up": 0, "down": 0, "warning": 0, "unknown": 0, "down_ack": 0}
    for group in tree:
        for host in group["hosts"]:
            s = host.get("status", "unknown")
            status_counts[s] = status_counts.get(s, 0) + 1

    summary = {
        "groups": total_groups,
        "hosts": total_hosts,
        "sensors": total_sensors,
        "problems": total_problems,
        "by_status": status_counts,
    }

    await cache.set("sensors:summary", summary, ttl=20)
    return summary
