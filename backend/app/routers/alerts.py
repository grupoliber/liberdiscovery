"""
LiberDiscovery - Router: Alertas
Endpoints para gerenciamento de alertas/problemas via Zabbix.
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.services.zabbix_client import zabbix
from app.services.cache import cache

router = APIRouter()


class AckRequest(BaseModel):
    event_ids: list[str]
    message: str = ""


class CloseRequest(BaseModel):
    event_ids: list[str]
    message: str = ""


@router.get("/alerts")
async def list_alerts(
    severity_min: int = Query(0, ge=0, le=5, description="Severidade mínima (0-5)"),
    acknowledged: bool | None = Query(None, description="Filtrar por reconhecido"),
    limit: int = Query(100, ge=1, le=1000),
):
    """Lista problemas/alertas ativos do Zabbix."""
    problems = await zabbix.get_problems(
        severity_min=severity_min,
        limit=limit,
        acknowledged=acknowledged,
    )
    return problems


@router.get("/alerts/triggers")
async def list_triggers(
    host_id: str | None = Query(None),
    min_severity: int = Query(0, ge=0, le=5),
    only_active: bool = Query(True),
):
    """Lista triggers (regras de alerta) do Zabbix."""
    host_ids = [host_id] if host_id else None
    triggers = await zabbix.get_triggers(
        host_ids=host_ids,
        only_active=only_active,
        min_severity=min_severity,
    )
    return triggers


@router.post("/alerts/ack")
async def acknowledge_alerts(req: AckRequest):
    """Reconhece um ou mais alertas."""
    result = await zabbix.acknowledge_event(req.event_ids, req.message)
    await cache.flush_pattern("dashboard:*")
    return {"status": "ok", "result": result}


@router.post("/alerts/close")
async def close_alerts(req: CloseRequest):
    """Fecha manualmente um ou mais problemas."""
    result = await zabbix.close_problem(req.event_ids, req.message)
    await cache.flush_pattern("dashboard:*")
    return {"status": "ok", "result": result}


# === Severidades do Zabbix (referência) ===
# 0 = Not classified
# 1 = Information
# 2 = Warning
# 3 = Average
# 4 = High
# 5 = Disaster
