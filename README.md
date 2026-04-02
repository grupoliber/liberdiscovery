# LiberDiscovery

Sistema de monitoramento e descoberta de rede para ISPs.

## 📋 Visão Geral

LiberDiscovery é uma solução completa de Network Monitoring System (NMS) projetada para ISPs brasileiros. Combina descoberta automática de dispositivos, monitoramento SNMP/ICMP, análise de NetFlow e alertas inteligentes.

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          LiberDiscovery                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        Dashboard                                 │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │    │
│  │  │   Network    │  │   Alerts     │  │   Topology             │ │    │
│  │  │    Map       │  │   Center     │  │   Viewer               │ │    │
│  │  └──────────────┘  └──────────────┘  └────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       Collectors                                 │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │    │
│  │  │    SNMP      │  │    ICMP      │  │   NetFlow/sFlow        │ │    │
│  │  │   Poller     │  │   Pinger     │  │   Collector            │ │    │
│  │  └──────────────┘  └──────────────┘  └────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        Engine                                    │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │    │
│  │  │  Discovery   │  │   Alert      │  │   Correlation          │ │    │
│  │  │   Engine     │  │   Manager    │  │   Engine               │ │    │
│  │  └──────────────┘  └──────────────┘  └────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       Storage                                    │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │    │
│  │  │  PostgreSQL  │  │   InfluxDB   │  │   Redis                │ │    │
│  │  │  (Config)    │  │  (Metrics)   │  │   (Cache/Queue)        │ │    │
│  │  └──────────────┘  └──────────────┘  └────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
             ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐
             │  Switches   │ │   Routers   │ │    OLTs     │
             │  Mikrotik   │ │   Huawei    │ │    ZTE      │
             └─────────────┘ └─────────────┘ └─────────────┘
```

## ✨ Funcionalidades

### Descoberta de Rede
- **Auto-discovery**: Varredura de ranges de IP
- **SNMP Discovery**: Detecção via SNMP walk
- **LLDP/CDP**: Descoberta de vizinhos
- **Fingerprinting**: Identificação de fabricante/modelo

### Monitoramento
- **SNMP Polling**: CPU, memória, interfaces, temperatura
- **ICMP Monitoring**: Latência e disponibilidade
- **NetFlow/sFlow**: Análise de tráfego
- **Custom OIDs**: Suporte a MIBs específicas

### Alertas
- **Thresholds**: Limites configuráveis
- **Escalation**: Níveis de severidade
- **Notificações**: Email, Slack, WhatsApp, Telegram
- **Correlação**: Agrupa alertas relacionados

### Visualização
- **Mapa de rede**: Topologia visual
- **Dashboards**: Gráficos em tempo real
- **Histórico**: Análise de tendências
- **Relatórios**: SLA, disponibilidade, performance

## 🚀 Instalação

```bash
curl -sSL https://saas.libernet.com.br/liberdiscovery/install.sh | bash
```

### Requisitos
- Ubuntu 20.04+ / Debian 11+
- 4GB RAM mínimo
- 50GB disco (mais para histórico)
- PostgreSQL 14+
- InfluxDB 2.x
- Redis 6+

## 📁 Estrutura do Projeto

```
liberdiscovery/
├── install.sh
├── docker-compose.yml
├── config/
│   ├── discovery.yml
│   ├── snmp.yml
│   └── alerts.yml
├── src/
│   ├── api/
│   │   └── main.py
│   ├── collectors/
│   │   ├── snmp_poller.py
│   │   ├── icmp_pinger.py
│   │   └── netflow_collector.py
│   ├── engine/
│   │   ├── discovery.py
│   │   ├── alerts.py
│   │   └── correlation.py
│   └── workers/
│       └── scheduler.py
├── web/
│   └── dashboard.html
├── mibs/
│   ├── mikrotik/
│   ├── huawei/
│   └── zte/
└── templates/
    └── notifications/
```

## 🔧 Configuração

### discovery.yml

```yaml
server:
  host: 0.0.0.0
  port: 8000
  
discovery:
  enabled: true
  scan_interval: 24h
  ranges:
    - 10.0.0.0/8
    - 172.16.0.0/12
    - 192.168.0.0/16
  exclude:
    - 10.0.0.1
    - 172.16.0.1
  methods:
    - icmp
    - snmp
    - lldp
    
snmp:
  version: 2c
  community: public
  timeout: 5s
  retries: 3
  polling_interval: 60s
  
icmp:
  interval: 30s
  timeout: 3s
  count: 3
  
netflow:
  enabled: true
  listen_port: 9995
  version: [5, 9, 10]  # NetFlow v5, v9, IPFIX
  
storage:
  postgres:
    host: localhost
    port: 5432
    database: liberdiscovery
  influxdb:
    host: localhost
    port: 8086
    org: libernet
    bucket: metrics
  redis:
    host: localhost
    port: 6379
    
alerts:
  check_interval: 30s
  default_severity: warning
  correlation_window: 5m
  notifications:
    - type: email
      recipients: ["noc@isp.com"]
    - type: slack
      webhook: https://hooks.slack.com/...
    - type: telegram
      bot_token: xxx
      chat_id: yyy
      
license:
  server_url: https://license.libernet.com.br
  key: ${LICENSE_KEY}
```

### snmp.yml

```yaml
# Templates SNMP por fabricante
templates:
  mikrotik:
    system:
      name: SNMPv2-MIB::sysName.0
      descr: SNMPv2-MIB::sysDescr.0
      uptime: SNMPv2-MIB::sysUpTime.0
    cpu: HOST-RESOURCES-MIB::hrProcessorLoad.1
    memory:
      total: HOST-RESOURCES-MIB::hrStorageSize.1
      used: HOST-RESOURCES-MIB::hrStorageUsed.1
    interfaces: IF-MIB::ifTable
    
  huawei_olt:
    system:
      name: SNMPv2-MIB::sysName.0
    onus:
      online: HUAWEI-XPON-MIB::hwGponOntInfoEntry
      status: HUAWEI-XPON-MIB::hwGponOntRunStatus
    optical:
      rx_power: HUAWEI-XPON-MIB::hwGponOntOpticalDdmRxPower
      tx_power: HUAWEI-XPON-MIB::hwGponOntOpticalDdmTxPower
      
  zte_olt:
    system:
      name: SNMPv2-MIB::sysName.0
    onus:
      online: ZTE-GPON-ONU-MIB::zxAnGponOntOnlineStateTable
    optical:
      rx_power: ZTE-GPON-ONU-MIB::zxAnGponOntRxPower
```

## 📊 API Endpoints

### Dispositivos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/devices` | Lista dispositivos |
| POST | `/api/v1/devices` | Adiciona dispositivo |
| GET | `/api/v1/devices/{id}` | Detalhes |
| DELETE | `/api/v1/devices/{id}` | Remove |
| POST | `/api/v1/devices/{id}/poll` | Força polling |

### Descoberta

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/v1/discovery/scan` | Inicia scan |
| GET | `/api/v1/discovery/status` | Status do scan |
| GET | `/api/v1/discovery/results` | Resultados |

### Métricas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/metrics/{device_id}` | Métricas atuais |
| GET | `/api/v1/metrics/{device_id}/history` | Histórico |
| GET | `/api/v1/metrics/interfaces` | Tráfego de interfaces |

### Alertas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/alerts` | Lista alertas |
| GET | `/api/v1/alerts/active` | Alertas ativos |
| POST | `/api/v1/alerts/{id}/ack` | Reconhece alerta |
| POST | `/api/v1/alerts/{id}/close` | Fecha alerta |

### Topologia

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/v1/topology` | Mapa da rede |
| GET | `/api/v1/topology/neighbors/{id}` | Vizinhos LLDP |

## 🚨 Tipos de Alerta

```yaml
alert_rules:
  - name: device_down
    condition: icmp_status == 'down'
    severity: critical
    message: "Dispositivo {device_name} está offline"
    
  - name: high_cpu
    condition: cpu_usage > 90
    duration: 5m
    severity: warning
    message: "CPU alta em {device_name}: {value}%"
    
  - name: interface_down
    condition: interface_status == 'down'
    severity: major
    message: "Interface {interface_name} down em {device_name}"
    
  - name: high_traffic
    condition: interface_utilization > 80
    severity: warning
    message: "Tráfego alto em {interface_name}: {value}%"
    
  - name: optical_low
    condition: onu_rx_power < -27
    severity: warning
    message: "Sinal óptico baixo em ONU {onu_serial}: {value} dBm"
```

## 📈 Métricas Coletadas

### Por Dispositivo
- Status (up/down)
- Latência (RTT)
- Jitter
- Packet loss
- CPU usage
- Memory usage
- Uptime

### Por Interface
- RX/TX bytes
- RX/TX packets
- Erros
- Discards
- Utilização %
- Status (up/down/admin down)

### OLTs
- ONUs online/offline
- Potência óptica RX/TX
- Temperatura
- Portas PON status

## 📊 Dashboards

O LiberDiscovery inclui dashboards pré-configurados:

- **Overview**: Visão geral da rede
- **Device Health**: Status de todos os dispositivos
- **Traffic Analysis**: Análise de tráfego top-N
- **OLT Monitor**: Monitoramento específico de OLTs
- **Alert History**: Histórico de alertas
- **SLA Report**: Relatório de disponibilidade

## 📄 Licenciamento

Produto comercial Libernet. Licenciado por número de dispositivos monitorados.

- **LiberDiscovery Starter**: Até 50 dispositivos
- **LiberDiscovery Pro**: Até 500 dispositivos
- **LiberDiscovery Enterprise**: Ilimitado

## 🆘 Suporte

- Email: suporte@libernet.com.br
- WhatsApp: (73) XXXX-XXXX
- Docs: https://docs.libernet.com.br/liberdiscovery
