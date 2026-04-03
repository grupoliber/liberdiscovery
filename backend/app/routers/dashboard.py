"""
LiberDiscovery - Router: Dashboard
Endpoints para o dashboard principal + configuração de widgets por host.
"""

import json
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.zabbix_client import zabbix
from app.services.cache import cache

router = APIRouter()

# Arquivo de configuração persistente dos dashboards
DASHBOARD_CONFIG_PATH = Path("/app/data/dashboards.json")

# Estrutura do arquivo:
# {
#   "_global": { "tabs": [...] },      # Dashboard geral (todos os hosts)
#   "10681": { "tabs": [...] },         # Dashboard personalizada do host 10681
#   "10682": { "tabs": [...] },         # Dashboard personalizada do host 10682
# }


class DashboardConfig(BaseModel):
    tabs: list[dict]


def _load_all_configs() -> dict:
    """Carrega todas as configs do arquivo."""
    if DASHBOARD_CONFIG_PATH.exists():
        try:
            data = json.loads(DASHBOARD_CONFIG_PATH.read_text())
            # Migração: se tem formato antigo ({"tabs": [...]}) converter para novo
            if "tabs" in data and "_global" not in data:
                return {"_global": data}
            return data
        except Exception:
            pass
    return {}


def _save_all_configs(configs: dict):
    """Salva todas as configs no arquivo."""
    DASHBOARD_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    DASHBOARD_CONFIG_PATH.write_text(json.dumps(configs, ensure_ascii=False, indent=2))


def _default_dashboard():
    """Retorna dashboard padrão para novos hosts."""
    return {"tabs": [
        {
            "id": "overview",
            "name": "Visão Geral",
            "widgets": [
                {"id": "w1", "type": "stat_cards", "title": "Resumo do Sistema", "config": {}, "w": 12, "h": 3, "x": 0, "y": 0},
                {"id": "w2", "type": "pie", "title": "Status dos Hosts", "config": {"source": "host_status"}, "w": 4, "h": 7, "x": 0, "y": 3},
                {"id": "w3", "type": "bar", "title": "Alertas por Severidade", "config": {"source": "severity"}, "w": 4, "h": 7, "x": 4, "y": 3},
                {"id": "w4", "type": "alert_list", "title": "Alertas Recentes", "config": {"limit": 10}, "w": 4, "h": 7, "x": 8, "y": 3},
            ],
        },
    ]}


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
async def get_dashboard_config(host_id: Optional[str] = Query(None)):
    """Retorna configuração salva do dashboard para um host específico ou global."""
    config_key = host_id if host_id else "_global"
    cache_key = f"dashboard:config:{config_key}"

    # Tentar cache primeiro
    cached = await cache.get(cache_key)
    if cached:
        return cached

    # Carregar do arquivo
    all_configs = _load_all_configs()

    if config_key in all_configs:
        data = all_configs[config_key]
        await cache.set(cache_key, data, ttl=3600)
        return data

    # Se não tem config para esse host, retornar default
    default = _default_dashboard()
    await cache.set(cache_key, default, ttl=3600)
    return default


@router.post("/dashboard/config")
async def save_dashboard_config(config: DashboardConfig, host_id: Optional[str] = Query(None)):
    """Salva configuração do dashboard para um host específico ou global."""
    config_key = host_id if host_id else "_global"
    data = config.model_dump()

    try:
        all_configs = _load_all_configs()
        all_configs[config_key] = data
        _save_all_configs(all_configs)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar: {str(e)}")

    # Atualizar cache
    cache_key = f"dashboard:config:{config_key}"
    await cache.set(cache_key, data, ttl=3600)
    # Invalidar cache antigo sem host_id
    await cache.delete("dashboard:config")
    await cache.delete(cache_key)

    return {"status": "ok", "host_id": config_key}


@router.delete("/dashboard/config")
async def delete_dashboard_config(host_id: str = Query(...)):
    """Remove configuração de dashboard de um host específico."""
    if host_id == "_global":
        raise HTTPException(status_code=400, detail="Não é possível remover a dashboard global")

    all_configs = _load_all_configs()
    if host_id in all_configs:
        del all_configs[host_id]
        _save_all_configs(all_configs)
        await cache.delete(f"dashboard:config:{host_id}")
        return {"status": "ok", "deleted": host_id}

    return {"status": "ok", "message": "Config não encontrada"}


@router.get("/dashboard/config/list")
async def list_dashboard_configs():
    """Lista todos os hosts que têm dashboard personalizada."""
    all_configs = _load_all_configs()
    return {
        "configs": [
            {"host_id": k, "tabs_count": len(v.get("tabs", []))}
            for k, v in all_configs.items()
        ]
    }


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
