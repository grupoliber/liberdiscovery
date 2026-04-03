"""
LiberDiscovery - Router: Dashboard
Endpoints para o dashboard principal + configuração de widgets.
"""

import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.zabbix_client import zabbix
from app.services.cache import cache

router = APIRouter()

# Arquivo de configuração persistente dos dashboards
DASHBOARD_CONFIG_PATH = Path("/app/data/dashboards.json")


class DashboardConfig(BaseModel):
    tabs: list[dict]


@router.get("/dashboard/stats")
async def get_dashboard_stats():
    """Retorna estatísticas gerais para o dashboard."""
    cached = await cache.get("dashboard:stats")
    if cached:
        return cached

    stats = await zabbix.get_dashboard_stats()
    await cache.set("dashboard:stats", stats, ttl=15)
    return stats


@router.get("/dashboard/config")
async def get_dashboard_config():
    """Retorna configuração salva dos dashboards (abas e widgets)."""
    # Tentar cache primeiro
    cached = await cache.get("dashboard:config")
    if cached:
        return cached

    # Tentar arquivo persistente
    if DASHBOARD_CONFIG_PATH.exists():
        try:
            data = json.loads(DASHBOARD_CONFIG_PATH.read_text())
            await cache.set("dashboard:config", data, ttl=3600)
            return data
        except Exception:
            pass

    # Config padrão
    default = {"tabs": [
        {
            "id": "overview",
            "name": "Visão Geral",
            "widgets": [
                {
                    "id": "w1",
                    "type": "stat_cards",
                    "title": "Resumo do Sistema",
                    "config": {},
                    "w": 12, "h": 1, "x": 0, "y": 0,
                },
                {
                    "id": "w2",
                    "type": "pie",
                    "title": "Status dos Hosts",
                    "config": {"source": "host_status"},
                    "w": 4, "h": 2, "x": 0, "y": 1,
                },
                {
                    "id": "w3",
                    "type": "bar",
                    "title": "Alertas por Severidade",
                    "config": {"source": "severity"},
                    "w": 4, "h": 2, "x": 4, "y": 1,
                },
                {
                    "id": "w4",
                    "type": "alert_list",
                    "title": "Alertas Recentes",
                    "config": {"limit": 10},
                    "w": 4, "h": 2, "x": 8, "y": 1,
                },
            ],
        },
    ]}
    return default


@router.post("/dashboard/config")
async def save_dashboard_config(config: DashboardConfig):
    """Salva configuração dos dashboards."""
    data = config.model_dump()

    # Salvar em arquivo persistente
    try:
        DASHBOARD_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        DASHBOARD_CONFIG_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar: {str(e)}")

    # Atualizar cache
    await cache.set("dashboard:config", data, ttl=3600)
    await cache.delete("dashboard:config")

    return {"status": "ok"}


@router.get("/dashboard/hosts-for-widget")
async def get_hosts_for_widget():
    """Lista hosts disponíveis para seleção em widgets."""
    cached = await cache.get("dashboard:hosts_widget")
    if cached:
        return cached

    hosts = await zabbix.get_hosts(limit=200)
    result = [
        {
            "hostid": h["hostid"],
            "name": h["name"],
            "available": h.get("available", "0"),
        }
        for h in hosts
    ]
    await cache.set("dashboard:hosts_widget", result, ttl=60)
    return result
