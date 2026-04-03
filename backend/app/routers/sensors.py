"""
LiberDiscovery - Router: Sensores
Endpoints estilo PRTG para visualização de sensores (items Zabbix).
"""

import logging
from fastapi import APIRouter, Query, HTTPException

from app.services.zabbix_client import zabbix, ZabbixAPIError
from app.services.cache import cache

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/sensors/summary")
async def get_sensors_summary():
    """Retorna resumo geral de sensores (estilo PRTG overview)."""
    try:
        cached = await cache.get("sensors:summary")
        if cached:
            return cached

        tree = await zabbix.get_sensors_tree()

        total_groups = len(tree)
        total_hosts = sum(g["host_count"] for g in tree)
        total_sensors = sum(g["sensor_count"] for g in tree)
        total_problems = sum(g["problem_count"] for g in tree)

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
    except ZabbixAPIError as e:
        logger.error("Erro Zabbix ao buscar summary: %s", e)
        raise HTTPException(status_code=502, detail=f"Zabbix: {e.message}")
    except Exception as e:
        logger.error("Erro ao buscar summary: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sensors/tree")
async def get_sensors_tree():
    """Retorna árvore hierárquica: Grupo > Host > Sensores (estilo PRTG)."""
    try:
        cached = await cache.get("sensors:tree")
        if cached:
            return cached

        tree = await zabbix.get_sensors_tree()
        await cache.set("sensors:tree", tree, ttl=20)
        return tree
    except ZabbixAPIError as e:
        logger.error("Erro Zabbix ao buscar sensors tree: %s", e)
        raise HTTPException(status_code=502, detail=f"Zabbix: {e.message}")
    except Exception as e:
        logger.error("Erro ao buscar sensors tree: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sensors/host/{host_id}")
async def get_host_sensors(
    host_id: str,
    search: str | None = Query(None, description="Buscar por nome"),
):
    """Lista sensores de um host específico, classificados por tipo."""
    try:
        from app.services.zabbix_client import _classify_sensors
        items = await zabbix.get_items(host_id, search=search)
        return _classify_sensors(items)
    except ZabbixAPIError as e:
        logger.error("Erro Zabbix ao buscar sensores do host %s: %s", host_id, e)
        raise HTTPException(status_code=502, detail=f"Zabbix: {e.message}")


@router.get("/sensors/{item_id}")
async def get_sensor_detail(item_id: str):
    """Retorna detalhes de um sensor com histórico recente (2h)."""
    try:
        detail = await zabbix.get_sensor_detail(item_id)
        if not detail:
            raise HTTPException(status_code=404, detail="Sensor não encontrado")
        return detail
    except ZabbixAPIError as e:
        logger.error("Erro Zabbix ao buscar sensor %s: %s", item_id, e)
        raise HTTPException(status_code=502, detail=f"Zabbix: {e.message}")
