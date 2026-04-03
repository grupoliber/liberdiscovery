"""
LiberDiscovery - Router: Auto-Discovery
Endpoints para gerenciar Network Discovery do Zabbix.
"""

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

from app.services.zabbix_client import zabbix, ZabbixAPIError
from app.services.cache import cache

router = APIRouter()


class DiscoveryRuleCreate(BaseModel):
    name: str
    ip_range: str
    delay: str = "1h"
    checks: list[dict] | None = None


class DiscoveryRuleUpdate(BaseModel):
    status: int | None = None  # 0=enabled, 1=disabled
    delay: str | None = None
    ip_range: str | None = None
    name: str | None = None


@router.get("/discovery/rules")
async def list_discovery_rules():
    """Lista regras de descoberta de rede configuradas no Zabbix."""
    rules = await zabbix.get_discovery_rules()
    return rules


@router.post("/discovery/rules")
async def create_discovery_rule(rule: DiscoveryRuleCreate):
    """Cria uma nova regra de descoberta de rede."""
    try:
        result = await zabbix.create_discovery_rule(
            name=rule.name,
            ip_range=rule.ip_range,
            delay=rule.delay,
            checks=rule.checks,
        )
        await cache.flush_pattern("discovery:*")
        return {"status": "ok", "result": result}
    except ZabbixAPIError as e:
        raise HTTPException(status_code=400, detail=f"Zabbix: {e.message} - {e.data}")


@router.put("/discovery/rules/{drule_id}")
async def update_discovery_rule(drule_id: str, update: DiscoveryRuleUpdate):
    """Atualiza uma regra de discovery."""
    params = {k: v for k, v in update.model_dump().items() if v is not None}
    result = await zabbix.update_discovery_rule(drule_id, **params)
    await cache.flush_pattern("discovery:*")
    return {"status": "ok", "result": result}


@router.delete("/discovery/rules/{drule_id}")
async def delete_discovery_rule(drule_id: str):
    """Remove uma regra de discovery."""
    result = await zabbix.delete_discovery_rule([drule_id])
    await cache.flush_pattern("discovery:*")
    return {"status": "ok", "result": result}


@router.get("/discovery/hosts")
async def list_discovered_hosts(
    drule_id: str | None = Query(None, description="Filtrar por regra"),
):
    """Lista hosts descobertos pelo Network Discovery do Zabbix."""
    hosts = await zabbix.get_discovery_hosts(drule_id=drule_id)
    return hosts


@router.get("/discovery/services")
async def list_web_scenarios(
    host_id: str | None = Query(None),
):
    """Lista web scenarios (HTTP checks) configurados."""
    scenarios = await zabbix.get_web_scenarios(host_id=host_id)
    return scenarios


# Tipos de check do Zabbix Discovery:
# 0  = SSH
# 1  = LDAP
# 2  = SMTP
# 3  = FTP
# 4  = HTTP
# 5  = POP
# 6  = NNTP
# 7  = IMAP
# 8  = TCP
# 9  = Zabbix agent
# 10 = SNMPv1 agent
# 11 = SNMPv2 agent
# 12 = ICMP ping
# 13 = SNMPv3 agent
# 14 = HTTPS
# 15 = Telnet
