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
            "selectTags": "extend",
            "sortfield": "eventid",
            "sortorder": "DESC",
            "severities": list(range(severity_min, 6)),
            "limit": limit,
            "recent": True,
            "suppressed": False,
        }
        if acknowledged is not None:
            params["acknowledged"] = acknowledged

        problems = await self._request("problem.get", params)

        # Buscar hosts via triggers (problem.get no Zabbix 7 não suporta selectHosts)
        if problems:
            trigger_ids = list(set(p["objectid"] for p in problems if p.get("objectid")))
            if trigger_ids:
                triggers = await self._request("trigger.get", {
                    "triggerids": trigger_ids,
                    "output": ["triggerid"],
                    "selectHosts": ["hostid", "name"],
                })
                trigger_host_map = {
                    t["triggerid"]: t.get("hosts", []) for t in triggers
                }
                for p in problems:
                    p["hosts"] = trigger_host_map.get(p["objectid"], [])

        return problems

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


    # ========== Sensores (Items como sensores PRTG) ==========

    async def get_sensors_tree(self) -> list[dict]:
        """Retorna árvore: Grupo > Host > Sensores (items + triggers)."""
        groups = await self._request("hostgroup.get", {
            "output": ["groupid", "name"],
            "selectHosts": ["hostid", "name", "status", "available"],
            "sortfield": "name",
            "filter": {"flags": 0},  # apenas grupos normais
        })

        tree = []
        for group in groups:
            hosts = group.get("hosts", [])
            if not hosts:
                continue

            host_ids = [h["hostid"] for h in hosts]

            # Buscar items (sensores) de todos os hosts do grupo
            items = await self._request("item.get", {
                "hostids": host_ids,
                "output": ["itemid", "hostid", "name", "key_", "lastvalue",
                           "units", "lastclock", "value_type", "status", "state",
                           "error"],
                "filter": {"status": 0},
                "sortfield": "name",
            })

            # Buscar triggers ativos dos hosts
            triggers = await self._request("trigger.get", {
                "hostids": host_ids,
                "output": ["triggerid", "description", "priority", "value",
                           "lastchange"],
                "selectHosts": ["hostid"],
                "filter": {"status": 0},
            })

            # Montar mapa de triggers por host
            triggers_by_host = {}
            for t in triggers:
                for h in t.get("hosts", []):
                    hid = h["hostid"]
                    triggers_by_host.setdefault(hid, []).append(t)

            # Montar mapa de items por host
            items_by_host = {}
            for item in items:
                hid = item["hostid"]
                items_by_host.setdefault(hid, []).append(item)

            group_hosts = []
            for host in hosts:
                hid = host["hostid"]
                host_items = items_by_host.get(hid, [])
                host_triggers = triggers_by_host.get(hid, [])

                # Classificar sensores por tipo (estilo PRTG)
                sensors = _classify_sensors(host_items)

                # Status geral do host baseado nos triggers
                active_triggers = [t for t in host_triggers if t.get("value") == "1"]
                max_severity = max(
                    (int(t["priority"]) for t in active_triggers), default=0
                )

                group_hosts.append({
                    "hostid": hid,
                    "name": host["name"],
                    "available": host.get("available", "0"),
                    "status": _host_status(host.get("available", "0"), max_severity),
                    "sensor_count": len(host_items),
                    "problem_count": len(active_triggers),
                    "max_severity": max_severity,
                    "sensors": sensors,
                })

            total_sensors = sum(h["sensor_count"] for h in group_hosts)
            total_problems = sum(h["problem_count"] for h in group_hosts)

            tree.append({
                "groupid": group["groupid"],
                "name": group["name"],
                "host_count": len(group_hosts),
                "sensor_count": total_sensors,
                "problem_count": total_problems,
                "hosts": group_hosts,
            })

        return tree

    async def get_sensor_detail(self, item_id: str) -> dict:
        """Retorna detalhes de um sensor (item) com histórico recente."""
        items = await self._request("item.get", {
            "itemids": [item_id],
            "output": "extend",
            "selectHosts": ["hostid", "name"],
            "selectTriggers": ["triggerid", "description", "priority", "value"],
        })
        if not items:
            return {}

        item = items[0]
        value_type = int(item.get("value_type", 0))

        # Histórico das últimas 2 horas
        import time
        time_from = int(time.time()) - 7200

        history = await self.get_history(
            [item_id], value_type=value_type, time_from=time_from, limit=120
        )

        return {**item, "history": history}

    # ========== Auto-Discovery (Zabbix Network Discovery) ==========

    async def get_discovery_rules(self) -> list[dict]:
        """Lista regras de descoberta de rede (Network Discovery)."""
        return await self._request("drule.get", {
            "output": ["druleid", "name", "iprange", "delay", "status"],
            "selectDChecks": ["dcheckid", "type", "ports"],
            "selectDHosts": "count",
        })

    async def get_discovery_hosts(self, drule_id: str | None = None) -> list[dict]:
        """Lista hosts descobertos pelo discovery."""
        params = {
            "output": ["dhostid", "druleid", "status", "lastup", "lastdown"],
            "selectDServices": ["dserviceid", "type", "port", "ip",
                                "status", "lastup", "lastdown", "value"],
        }
        if drule_id:
            params["druleids"] = [drule_id]

        return await self._request("dhost.get", params)

    async def create_discovery_rule(
        self,
        name: str,
        ip_range: str,
        delay: str = "1h",
        checks: list[dict] | None = None,
    ) -> dict:
        """Cria uma nova regra de descoberta de rede."""
        if checks is None:
            checks = [
                {"type": 12},                     # ICMP ping (type 12)
                {"type": 11, "ports": "161"},     # SNMPv2 agent (type 11)
                {"type": 9, "ports": "10050"},    # Zabbix agent (type 9)
            ]

        return await self._request("drule.create", {
            "name": name,
            "iprange": ip_range,
            "delay": delay,
            "dchecks": checks,
        })

    async def update_discovery_rule(self, drule_id: str, **kwargs) -> dict:
        """Atualiza uma regra de discovery."""
        params = {"druleid": drule_id, **kwargs}
        return await self._request("drule.update", params)

    async def delete_discovery_rule(self, drule_ids: list[str]) -> dict:
        """Remove regras de discovery."""
        return await self._request("drule.delete", drule_ids)

    # ========== Sensores de Serviço (HTTP, DNS, Port) ==========

    async def get_web_scenarios(self, host_id: str | None = None) -> list[dict]:
        """Lista web scenarios (HTTP checks) do Zabbix."""
        params = {
            "output": ["httptestid", "name", "delay", "status", "nextcheck"],
            "selectHosts": ["hostid", "name"],
            "selectSteps": ["httpstepid", "name", "url", "status_codes", "timeout"],
        }
        if host_id:
            params["hostids"] = [host_id]

        return await self._request("httptest.get", params)

    # ========== SLA / Disponibilidade ==========

    async def get_sla_list(self) -> list[dict]:
        """Lista SLAs configurados."""
        return await self._request("sla.get", {
            "output": "extend",
            "selectServiceTags": "extend",
        })

    async def get_sla_report(
        self,
        sla_id: str,
        period_from: int,
        period_to: int,
    ) -> dict:
        """Retorna relatório de SLA para um período."""
        return await self._request("sla.getsli", {
            "slaid": sla_id,
            "period_from": period_from,
            "period_to": period_to,
        })

    # ========== Templates ==========

    async def get_templates(self, search: str | None = None) -> list[dict]:
        """Lista templates disponíveis."""
        params = {
            "output": ["templateid", "name", "description"],
            "selectItems": "count",
            "selectTriggers": "count",
            "sortfield": "name",
        }
        if search:
            params["search"] = {"name": search}

        return await self._request("template.get", params)

    # ========== Graphs (para widgets) ==========

    async def get_graphs(self, host_id: str | None = None) -> list[dict]:
        """Lista gráficos configurados."""
        params = {
            "output": ["graphid", "name", "width", "height", "graphtype"],
            "selectHosts": ["hostid", "name"],
            "sortfield": "name",
        }
        if host_id:
            params["hostids"] = [host_id]

        return await self._request("graph.get", params)

    async def get_graph_items(self, graph_id: str) -> list[dict]:
        """Retorna items de um gráfico."""
        return await self._request("graphitem.get", {
            "graphids": [graph_id],
            "output": "extend",
            "selectItems": ["itemid", "name", "key_", "units"],
        })


def _classify_sensors(items: list[dict]) -> dict:
    """Classifica items do Zabbix em categorias estilo PRTG."""
    categories = {
        "ping": [],
        "snmp_traffic": [],
        "cpu_memory": [],
        "interfaces": [],
        "http": [],
        "dns": [],
        "port": [],
        "olt_gpon": [],
        "other": [],
    }

    for item in items:
        key = item.get("key_", "").lower()
        name = item.get("name", "").lower()

        if "icmpping" in key or "ping" in key:
            categories["ping"].append(item)
        elif "net.if" in key or "ifhc" in key.lower() or "interface" in name:
            categories["interfaces"].append(item)
        elif any(k in key for k in ["system.cpu", "hrprocessor", "processor"]):
            categories["cpu_memory"].append(item)
        elif any(k in key for k in ["vm.memory", "hrstorage", "memory"]):
            categories["cpu_memory"].append(item)
        elif any(k in key for k in ["net.tcp", "tcp.port"]):
            categories["port"].append(item)
        elif any(k in key for k in ["net.dns", "dns"]):
            categories["dns"].append(item)
        elif any(k in key for k in ["web.test", "http"]):
            categories["http"].append(item)
        elif any(k in key for k in ["gpon", "ont", "onu", "olt", "xpon", "optical"]):
            categories["olt_gpon"].append(item)
        elif any(k in name for k in ["traffic", "bandwidth", "bits"]):
            categories["snmp_traffic"].append(item)
        else:
            categories["other"].append(item)

    return {k: v for k, v in categories.items() if v}


def _host_status(available: str, max_severity: int) -> str:
    """Calcula status estilo PRTG: up/down/warning/paused."""
    if available == "2":
        return "down"
    if max_severity >= 4:
        return "down_ack"
    if max_severity >= 2:
        return "warning"
    if available == "1":
        return "up"
    return "unknown"


class ZabbixAPIError(Exception):
    """Erro retornado pela Zabbix API."""

    def __init__(self, code: int, message: str, data: str = ""):
        self.code = code
        self.message = message
        self.data = data
        super().__init__(f"Zabbix API Error [{code}]: {message} - {data}")


# Singleton
zabbix = ZabbixClient()
