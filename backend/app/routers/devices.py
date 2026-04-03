"""
LiberDiscovery - Router: Dispositivos
Endpoints para gerenciamento completo de hosts/dispositivos via Zabbix.
"""

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

import subprocess
import asyncio

from app.services.zabbix_client import zabbix, ZabbixAPIError
from app.services.cache import cache

router = APIRouter()


# ========== Models ==========

class InterfaceInput(BaseModel):
    type: int = 1  # 1=agent, 2=SNMP, 3=IPMI, 4=JMX
    ip: str
    port: str = "10050"
    main: int = 1
    useip: int = 1
    dns: str = ""
    # SNMP details
    version: int | None = None  # 1, 2, 3
    community: str | None = None  # SNMPv1/v2
    securityname: str | None = None  # SNMPv3
    securitylevel: int | None = None  # SNMPv3: 0=noAuth, 1=auth, 2=authPriv
    authprotocol: int | None = None  # SNMPv3: 0=MD5, 1=SHA1...
    authpassphrase: str | None = None
    privprotocol: int | None = None
    privpassphrase: str | None = None
    bulk: int = 1


class HostCreateInput(BaseModel):
    name: str
    host: str  # technical name / hostname
    ip: str
    group_ids: list[str]
    template_ids: list[str] | None = None
    description: str = ""
    # Interface principal
    interface_type: int = 1  # 1=agent, 2=SNMP
    agent_port: str = "10050"
    # SNMP config
    snmp_version: int | None = None  # 2 ou 3
    snmp_community: str = "public"
    snmp_port: str = "161"
    # SNMPv3
    snmpv3_securityname: str | None = None
    snmpv3_securitylevel: int | None = None
    snmpv3_authprotocol: int | None = None
    snmpv3_authpassphrase: str | None = None
    snmpv3_privprotocol: int | None = None
    snmpv3_privpassphrase: str | None = None


class HostUpdateInput(BaseModel):
    name: str | None = None
    host: str | None = None
    description: str | None = None
    status: int | None = None  # 0=monitored, 1=unmonitored
    group_ids: list[str] | None = None
    template_ids: list[str] | None = None


class InterfaceCreateInput(BaseModel):
    type: int = 2  # 1=agent, 2=SNMP
    ip: str
    port: str = "161"
    main: int = 0
    useip: int = 1
    dns: str = ""
    snmp_version: int | None = 2
    snmp_community: str = "public"


class GroupCreateInput(BaseModel):
    name: str


# ========== Read Endpoints ==========

@router.get("/devices")
async def list_devices(
    group_id: str | None = Query(None, description="Filtrar por grupo"),
    limit: int = Query(200, ge=1, le=1000),
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


@router.get("/devices/templates")
async def list_templates(
    search: str | None = Query(None, description="Buscar por nome"),
):
    """Lista templates disponíveis para vincular a dispositivos."""
    templates = await zabbix.get_templates(search=search)
    return templates


@router.get("/devices/{host_id}")
async def get_device(host_id: str):
    """Retorna detalhes de um dispositivo."""
    host = await zabbix.get_host(host_id)
    return host


@router.get("/devices/{host_id}/interfaces")
async def get_device_interfaces(host_id: str):
    """Lista interfaces de um dispositivo."""
    return await zabbix.get_host_interfaces(host_id)




@router.get("/devices/{host_id}/interfaces-detail")
async def get_device_interfaces_detail(host_id: str):
    """
    Retorna interfaces de rede agrupadas por nome com tráfego em bps,
    status operacional, velocidade, erros e item IDs para graficos.
    Otimizado para Mikrotik e equipamentos SNMP.
    """
    try:
        interfaces = await zabbix.get_host_network_interfaces(host_id)
        return interfaces
    except ZabbixAPIError as e:
        raise HTTPException(status_code=400, detail=f"Zabbix: {e.message} - {e.data}")


class InterfaceTriggerInput(BaseModel):
    interface_name: str
    trigger_type: str  # "link_down", "link_up", "sfp_signal"
    item_id: str  # item ID para compor a expressao
    host_name: str  # nome tecnico do host para expressao
    threshold: float | None = None  # para sfp_signal, valor em dBm
    priority: int = 3  # 1=info, 2=warning, 3=average, 4=high, 5=disaster


@router.post("/devices/{host_id}/interfaces-alert")
async def create_interface_alert(host_id: str, data: InterfaceTriggerInput):
    """
    Cria trigger/alerta para monitoramento de interface:
    - link_down: alerta quando interface fica down
    - sfp_signal: alerta quando sinal optico ultrapassa threshold
    """
    try:
        if data.trigger_type == "link_down":
            description = f"Interface {data.interface_name} is DOWN on {{{data.host_name}}}"
            # ifOperStatus: 1=up, 2=down
            expression = f"last(/{data.host_name}/{data.item_id})=2"
            # Precisamos usar o key_ do item, não o itemid
            # Buscar o key_ do item
            items = await zabbix._request("item.get", {
                "itemids": [data.item_id],
                "output": ["key_"],
            })
            if not items:
                raise HTTPException(status_code=404, detail="Item não encontrado")
            item_key = items[0]["key_"]
            expression = f"last(/{data.host_name}/{item_key})=2"

        elif data.trigger_type == "sfp_signal":
            if data.threshold is None:
                raise HTTPException(status_code=400, detail="Threshold obrigatório para sfp_signal")
            items = await zabbix._request("item.get", {
                "itemids": [data.item_id],
                "output": ["key_"],
            })
            if not items:
                raise HTTPException(status_code=404, detail="Item não encontrado")
            item_key = items[0]["key_"]
            description = f"SFP signal on {data.interface_name} above {data.threshold} dBm on {{{data.host_name}}}"
            expression = f"last(/{data.host_name}/{item_key})>{data.threshold}"

        else:
            raise HTTPException(status_code=400, detail=f"Tipo de trigger desconhecido: {data.trigger_type}")

        result = await zabbix.create_interface_trigger(
            host_id=host_id,
            description=description,
            expression=expression,
            priority=data.priority,
            tags=[
                {"tag": "interface", "value": data.interface_name},
                {"tag": "trigger_type", "value": data.trigger_type},
                {"tag": "source", "value": "liberdiscovery"},
            ],
        )
        await cache.flush_pattern(f"devices:{host_id}*")
        return {"status": "ok", "triggerids": result.get("triggerids", [])}

    except ZabbixAPIError as e:
        raise HTTPException(status_code=400, detail=f"Zabbix: {e.message} - {e.data}")




@router.get("/devices/{host_id}/pppoe-stats")
async def get_pppoe_stats(host_id: str):
    """
    Retorna estatísticas de sessões PPPoE de um roteador Huawei NE40.
    Faz SNMP walk na MIB hwBRAS para contar sessões ativas.
    """
    try:
        # Buscar IP e community SNMP do host
        interfaces = await zabbix.get_host_interfaces(host_id)
        snmp_iface = next((i for i in interfaces if i.get("type") == "2"), None)
        if not snmp_iface:
            raise HTTPException(status_code=400, detail="Host não possui interface SNMP")

        ip = snmp_iface["ip"]
        community = snmp_iface.get("details", {}).get("community", "public")

        # OID base: hwBRAS access user session table
        base_oid = "1.3.6.1.4.1.2011.5.25.40.12.1.2.1.1"

        # Executar snmpwalk para contar sessões (em thread separada)
        def do_snmpwalk():
            try:
                result = subprocess.run(
                    ["snmpwalk", "-v2c", "-c", community, "-t", "20", ip, base_oid],
                    capture_output=True, text=True, timeout=30
                )
                if result.returncode != 0:
                    return None, result.stderr
                lines = [l for l in result.stdout.strip().splitlines() if l]
                if not lines:
                    return {"total": 0, "by_interface": {}, "interfaces": {}}, None

                # Contar por interface index
                by_iface = {}
                for line in lines:
                    # Format: iso.3.6.1.4.1.2011.5.25.40.12.1.2.1.1.<iface_idx>.<session_id>.<x> = INTEGER: <val>
                    parts = line.split("=")[0].strip().split(".")
                    if len(parts) > 15:
                        iface_idx = parts[15]
                        by_iface[iface_idx] = by_iface.get(iface_idx, 0) + 1

                return {
                    "total": len(lines),
                    "by_interface": by_iface,
                }, None
            except subprocess.TimeoutExpired:
                return None, "SNMP timeout"
            except Exception as e:
                return None, str(e)

        loop = asyncio.get_event_loop()
        data, error = await loop.run_in_executor(None, do_snmpwalk)

        if error:
            # Fallback: tentar via OID de dominio (.40.15)
            raise HTTPException(status_code=500, detail=f"Erro SNMP: {error}")

        # Mapear interface indexes para nomes
        try:
            net_ifaces = await zabbix.get_host_network_interfaces(host_id)
            iface_names = {i["index"]: i["name"] for i in net_ifaces}
        except Exception:
            iface_names = {}

        # Enriquecer com nomes
        by_interface_named = {}
        for idx, count in data["by_interface"].items():
            name = iface_names.get(idx, f"Interface {idx}")
            by_interface_named[name] = {
                "index": idx,
                "sessions": count,
            }

        return {
            "total_sessions": data["total"],
            "by_interface": by_interface_named,
            "host_ip": ip,
        }

    except HTTPException:
        raise
    except ZabbixAPIError as e:
        raise HTTPException(status_code=400, detail=f"Zabbix: {e.message} - {e.data}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {str(e)}")


# ========== Create Endpoints ==========

@router.post("/devices")
async def create_device(data: HostCreateInput):
    """Cria um novo dispositivo com interfaces configuradas."""
    try:
        # Montar interface principal
        interfaces = []

        if data.interface_type == 2:
            # Interface SNMP
            snmp_details = _build_snmp_details(
                version=data.snmp_version or 2,
                community=data.snmp_community,
                securityname=data.snmpv3_securityname,
                securitylevel=data.snmpv3_securitylevel,
                authprotocol=data.snmpv3_authprotocol,
                authpassphrase=data.snmpv3_authpassphrase,
                privprotocol=data.snmpv3_privprotocol,
                privpassphrase=data.snmpv3_privpassphrase,
            )
            interfaces.append({
                "type": 2,
                "main": 1,
                "useip": 1,
                "ip": data.ip,
                "dns": "",
                "port": data.snmp_port,
                "details": snmp_details,
            })
        else:
            # Interface Agent
            interfaces.append({
                "type": 1,
                "main": 1,
                "useip": 1,
                "ip": data.ip,
                "dns": "",
                "port": data.agent_port,
            })

        result = await zabbix.create_host(
            name=data.name,
            host=data.host,
            group_ids=data.group_ids,
            interfaces=interfaces,
            template_ids=data.template_ids,
            description=data.description,
        )

        await cache.flush_pattern("devices:*")
        return {"status": "ok", "hostids": result.get("hostids", [])}

    except ZabbixAPIError as e:
        raise HTTPException(status_code=400, detail=f"Zabbix: {e.message} - {e.data}")


@router.post("/devices/groups")
async def create_device_group(data: GroupCreateInput):
    """Cria um novo grupo de dispositivos."""
    try:
        result = await zabbix.create_host_group(data.name)
        await cache.flush_pattern("devices:groups*")
        return {"status": "ok", "groupids": result.get("groupids", [])}
    except ZabbixAPIError as e:
        raise HTTPException(status_code=400, detail=f"Zabbix: {e.message} - {e.data}")


@router.post("/devices/{host_id}/interfaces")
async def add_device_interface(host_id: str, data: InterfaceCreateInput):
    """Adiciona uma interface a um dispositivo existente."""
    try:
        details = None
        if data.type == 2:
            details = _build_snmp_details(
                version=data.snmp_version or 2,
                community=data.snmp_community,
            )

        result = await zabbix.create_host_interface(
            host_id=host_id,
            type=data.type,
            ip=data.ip,
            port=data.port,
            main=data.main,
            useip=data.useip,
            dns=data.dns,
            details=details,
        )
        await cache.flush_pattern(f"devices:{host_id}*")
        return {"status": "ok", "interfaceids": result.get("interfaceids", [])}
    except ZabbixAPIError as e:
        raise HTTPException(status_code=400, detail=f"Zabbix: {e.message} - {e.data}")


# ========== Update Endpoints ==========

@router.put("/devices/{host_id}")
async def update_device(host_id: str, data: HostUpdateInput):
    """Atualiza um dispositivo."""
    try:
        params = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await zabbix.update_host(host_id, **params)
        await cache.flush_pattern("devices:*")
        return {"status": "ok", "result": result}
    except ZabbixAPIError as e:
        raise HTTPException(status_code=400, detail=f"Zabbix: {e.message} - {e.data}")


@router.put("/devices/{host_id}/templates")
async def link_templates(host_id: str, template_ids: list[str]):
    """Vincula templates a um dispositivo."""
    try:
        result = await zabbix.update_host(host_id, template_ids=template_ids)
        await cache.flush_pattern("devices:*")
        return {"status": "ok", "result": result}
    except ZabbixAPIError as e:
        raise HTTPException(status_code=400, detail=f"Zabbix: {e.message} - {e.data}")


# ========== Delete Endpoints ==========

@router.delete("/devices/{host_id}")
async def delete_device(host_id: str):
    """Remove um dispositivo do Zabbix."""
    try:
        result = await zabbix.delete_hosts([host_id])
        await cache.flush_pattern("devices:*")
        return {"status": "ok", "result": result}
    except ZabbixAPIError as e:
        raise HTTPException(status_code=400, detail=f"Zabbix: {e.message} - {e.data}")


@router.delete("/devices/{host_id}/interfaces/{interface_id}")
async def delete_device_interface(host_id: str, interface_id: str):
    """Remove uma interface de um dispositivo."""
    try:
        result = await zabbix.delete_host_interfaces([interface_id])
        await cache.flush_pattern(f"devices:{host_id}*")
        return {"status": "ok", "result": result}
    except ZabbixAPIError as e:
        raise HTTPException(status_code=400, detail=f"Zabbix: {e.message} - {e.data}")


# ========== Helpers ==========

def _build_snmp_details(
    version: int = 2,
    community: str = "public",
    securityname: str | None = None,
    securitylevel: int | None = None,
    authprotocol: int | None = None,
    authpassphrase: str | None = None,
    privprotocol: int | None = None,
    privpassphrase: str | None = None,
) -> dict:
    """Constrói o dict de detalhes SNMP para interfaces."""
    details = {
        "version": str(version),
        "bulk": "1",
    }

    if version in (1, 2):
        details["community"] = community
    elif version == 3:
        details["securityname"] = securityname or ""
        details["securitylevel"] = str(securitylevel or 0)
        if securitylevel and securitylevel >= 1:
            details["authprotocol"] = str(authprotocol or 0)
            details["authpassphrase"] = authpassphrase or ""
        if securitylevel and securitylevel >= 2:
            details["privprotocol"] = str(privprotocol or 0)
            details["privpassphrase"] = privpassphrase or ""

    return details
