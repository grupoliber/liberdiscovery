"""
LiberDiscovery - Router: Métricas
Endpoints para consulta de métricas e histórico via Zabbix.
"""

from fastapi import APIRouter, Query

from app.services.zabbix_client import zabbix
from app.services.cache import cache

router = APIRouter()


@router.get("/metrics/{host_id}/items")
async def list_items(
    host_id: str,
    search: str | None = Query(None, description="Buscar por nome do item"),
):
    """Lista métricas (items) de um dispositivo."""
    items = await zabbix.get_items(host_id, search=search)
    return items


@router.get("/metrics/history")
async def get_history(
    item_ids: str = Query(..., description="IDs separados por vírgula"),
    value_type: int = Query(0, description="0=float, 1=char, 3=int, 4=text"),
    time_from: int | None = Query(None, description="Unix timestamp início"),
    time_till: int | None = Query(None, description="Unix timestamp fim"),
    limit: int = Query(500, ge=1, le=10000),
):
    """Retorna histórico de valores de métricas."""
    ids = [i.strip() for i in item_ids.split(",")]
    history = await zabbix.get_history(
        item_ids=ids,
        value_type=value_type,
        time_from=time_from,
        time_till=time_till,
        limit=limit,
    )
    return history
