"""
LiberDiscovery - Zabbix API Client
Client assíncrono para comunicação com a Zabbix JSON-RPC API.
"""

import httpx
from typing import Any

from app.core.config import settings


class ZabbixClient:
    """Client para a Zabbix API JSON-RPC 2.0."""

    def __init__(self):
        self.url = settings.zabbix_url
        self.auth_token: str | None = None
        self._request_id = 0

    async def login(self) -> str:
        """Autentica na Zabbix API e retorna o token."""
        result = await self._request("user.login", {
            "username": settings.zabbix_user,
            "password": settings.zabbix_password,
        }, auth=False)
        self.auth_token = result
        return result

    async def logout(self):
        """Encerra a sessão na Zabbix API."""
        if self.auth_token:
            await self._request("user.logout", [])
            self.auth_token = None

    async def _request(self, method: str, params: Any, auth: bool = True) -> Any:
        """Executa uma chamada JSON-RPC na Zabbix API."""
        self._request_id += 1

        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": self._request_id,
        }

        if auth and self.auth_token:
            payload["auth"] = self.auth_token

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self.url, json=payload)
            response.raise_for_status()
            data = response.json()

        if "error" in data:
            error = data["error"]
            raise ZabbixAPIError(
                code=error.get("code", -1),
                message=error.get("message", "Unknown error"),
                data=error.get("data", ""),
            )

        return data.get("result")

    # ========== Hosts ==========

    async def get_hosts(self, group_ids: list[str] | None = None, limit: int = 100) -> list[dict]:
        """Lista hosts monitorados."""
        params = {
            "output": ["hostid", "host", "name", "status", "description",
                       "maintenance_status", "snmp_available", "available"],
            "selectInterfaces": ["interfaceid", "ip", "port", "type"],
            "selectGroups": ["groupid", "name"],
            "selectParentTemplates": ["templateid", "name"],
            "sortfield": "name",
            "limit": limit,
        }
        if group_ids:
            params["groupids"] = group_ids

        return await self._request("host.get", params)

    async def get_host(self, host_id: str) -> dict:
        """Retorna detalhes de um host específico."""
        result = await self._request("host.get", {
            "hostids": [host_id],
            "output": "extend",
            "selectInterfaces": "extend",
            "selectGroups": ["groupid", "name"],
            "selectParentTemplates": ["templateid", "name"],
            "selectItems": ["itemid", "name", "lastvalue", "units", "lastclock"],
            "selectTriggers": ["triggerid", "description", "priority", "value"],
        })
        return result[0] if result else {}

    # ========== Host Groups ==========

    async def get_host_groups(self) -> list[dict]:
        """Lista grupos de hosts."""
        return await self._request("hostgroup.get", {
            "output": ["groupid", "name"],
            "selectHosts": "count",
            "sortfield": "name",
        })

    # ========== Alertas / Problemas ==========

    async def get_problems(
        self,
        severity_min: int = 0,
        limit: int = 100,
        acknowledged: bool | None = None,
    ) -> list[dict]:
        """Lista problemas/alertas ativos."""
        params = {
            "output": ["eventid", "objectid", "name", "severity", "clock",
                       "r_eventid", "acknowledged", "suppressed"],
            "selectHosts": ["hostid", "name"],
            "selectTags": "extend",
            "sortfield": ["severity", "clock"],
            "sortorder": ["DESC", "DESC"],
            "severities": list(range(severity_min, 6)),
            "limit": limit,
            "recent": True,
            "suppressed": False,
        }
        if acknowledged is not None:
            params["acknowledged"] = acknowledged

        return await self._request("problem.get", params)

    async def acknowledge_event(self, event_ids: list[str], message: str = "") -> dict:
        """Reconhece um ou mais eventos/alertas."""
        return await self._request("event.acknowledge", {
            "eventids": event_ids,
            "action": 6,  # acknowledge + add message
            "message": message,
        })

    async def close_problem(self, event_ids: list[str], message: str = "") -> dict:
        """Fecha manualmente um problema."""
        return await self._request("event.acknowledge", {
            "eventids": event_ids,
            "action": 1,  # close problem
            "message": message,
        })

    # ========== Triggers ==========

    async def get_triggers(
        self,
        host_ids: list[str] | None = None,
        only_active: bool = True,
        min_severity: int = 0,
    ) -> list[dict]:
        """Lista triggers (regras de alerta)."""
        params = {
            "output": ["triggerid", "description", "priority", "value",
                       "lastchange", "status", "state"],
            "selectHosts": ["hostid", "name"],
            "selectItems": ["itemid", "name", "lastvalue"],
            "sortfield": "priority",
            "sortorder": "DESC",
            "min_severity": min_severity,
        }
        if only_active:
            params["filter"] = {"value": 1}  # PROBLEM state
        if host_ids:
            params["hostids"] = host_ids

        return await self._request("trigger.get", params)

    # ========== Métricas / Items ==========

    async def get_items(self, host_id: str, search: str | None = None) -> list[dict]:
        """Lista items (métricas) de um host."""
        params = {
            "hostids": [host_id],
            "output": ["itemid", "name", "key_", "lastvalue", "units",
                       "lastclock", "value_type", "status"],
            "sortfield": "name",
            "filter": {"status": 0},  # apenas habilitados
        }
        if search:
            params["search"] = {"name": search}

        return await self._request("item.get", params)

    async def get_history(
        self,
        item_ids: list[str],
        value_type: int = 0,
        time_from: int | None = None,
        time_till: int | None = None,
        limit: int = 500,
    ) -> list[dict]:
        """Retorna histórico de valores de items."""
        params = {
            "itemids": item_ids,
            "output": "extend",
            "sortfield": "clock",
            "sortorder": "DESC",
            "history": value_type,
            "limit": limit,
        }
        if time_from:
            params["time_from"] = time_from
        if time_till:
            params["time_till"] = time_till

        return await self._request("history.get", params)

    # ========== Topologia / Mapa ==========

    async def get_maps(self) -> list[dict]:
        """Lista mapas de rede do Zabbix."""
        return await self._request("map.get", {
            "output": ["sysmapid", "name", "width", "height"],
            "selectSelements": "extend",
            "selectLinks": "extend",
        })

    async def get_map(self, map_id: str) -> dict:
        """Retorna um mapa de rede específico."""
        result = await self._request("map.get", {
            "sysmapids": [map_id],
            "output": "extend",
            "selectSelements": "extend",
            "selectLinks": "extend",
        })
        return result[0] if result else {}

    # ========== Dashboard ==========

    async def get_dashboard_stats(self) -> dict:
        """Retorna estatísticas gerais para o dashboard."""
        hosts = await self._request("host.get", {
            "output": ["hostid", "status", "available"],
            "filter": {"status": 0},  # apenas monitorados
        })

        problems = await self.get_problems(severity_min=2)

        total_hosts = len(hosts)
        hosts_up = sum(1 for h in hosts if h.get("available") == "1")
        hosts_down = sum(1 for h in hosts if h.get("available") == "2")
        hosts_unknown = total_hosts - hosts_up - hosts_down

        severity_counts = {}
        for p in problems:
            sev = int(p.get("severity", 0))
            severity_counts[sev] = severity_counts.get(sev, 0) + 1

        return {
            "hosts": {
                "total": total_hosts,
                "up": hosts_up,
                "down": hosts_down,
                "unknown": hosts_unknown,
            },
            "problems": {
                "total": len(problems),
                "by_severity": severity_counts,
                "unacknowledged": sum(
                    1 for p in problems if p.get("acknowledged") == "0"
                ),
            },
        }


class ZabbixAPIError(Exception):
    """Erro retornado pela Zabbix API."""

    def __init__(self, code: int, message: str, data: str = ""):
        self.code = code
        self.message = message
        self.data = data
        super().__init__(f"Zabbix API Error [{code}]: {message} - {data}")


# Singleton
zabbix = ZabbixClient()
