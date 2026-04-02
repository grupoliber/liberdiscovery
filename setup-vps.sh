#!/bin/bash
# ============================================
# LiberDiscovery - Setup VPS
# Ubuntu 22.04/24.04 LTS
# Executa como root: sudo bash setup-vps.sh
# ============================================

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }

echo ""
echo "============================================"
echo "  LiberDiscovery - Setup VPS"
echo "  Network Monitoring System para ISPs"
echo "============================================"
echo ""

# Verificar se é root
if [ "$EUID" -ne 0 ]; then
  error "Execute como root: sudo bash setup-vps.sh"
fi

# ============================================
# 1. Atualizar sistema
# ============================================
echo ""
echo "--- 1/7 Atualizando sistema ---"
apt-get update -qq
apt-get upgrade -y -qq
log "Sistema atualizado"

# ============================================
# 2. Instalar dependências básicas
# ============================================
echo ""
echo "--- 2/7 Instalando dependências ---"
apt-get install -y -qq \
  curl \
  wget \
  git \
  htop \
  nano \
  ufw \
  fail2ban \
  unzip \
  ca-certificates \
  gnupg \
  lsb-release \
  software-properties-common
log "Dependências instaladas"

# ============================================
# 3. Instalar Docker
# ============================================
echo ""
echo "--- 3/7 Instalando Docker ---"
if command -v docker &> /dev/null; then
  warn "Docker já instalado: $(docker --version)"
else
  # Adicionar repo oficial Docker
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  # Habilitar e iniciar Docker
  systemctl enable docker
  systemctl start docker

  log "Docker instalado: $(docker --version)"
fi

# Adicionar usuario ao grupo docker (se não for root direto)
if [ -n "$SUDO_USER" ]; then
  usermod -aG docker "$SUDO_USER"
  log "Usuário '$SUDO_USER' adicionado ao grupo docker"
fi

# ============================================
# 4. Configurar Firewall
# ============================================
echo ""
echo "--- 4/7 Configurando Firewall ---"
ufw --force reset > /dev/null 2>&1
ufw default deny incoming
ufw default allow outgoing

# SSH
ufw allow 22/tcp

# LiberDiscovery Frontend
ufw allow 5173/tcp

# LiberDiscovery Backend API
ufw allow 8000/tcp

# Zabbix Web
ufw allow 8080/tcp

# Zabbix Server (para agents externos)
ufw allow 10051/tcp

# SNMP (para receber traps)
ufw allow 162/udp

# NetFlow
ufw allow 9995/udp

ufw --force enable
log "Firewall configurado (portas: 22, 5173, 8000, 8080, 10051, 162/udp, 9995/udp)"

# ============================================
# 5. Configurar Fail2Ban
# ============================================
echo ""
echo "--- 5/7 Configurando Fail2Ban ---"
systemctl enable fail2ban
systemctl start fail2ban
log "Fail2Ban ativo"

# ============================================
# 6. Clonar e subir LiberDiscovery
# ============================================
echo ""
echo "--- 6/7 Instalando LiberDiscovery ---"

INSTALL_DIR="/opt/liberdiscovery"

if [ -d "$INSTALL_DIR" ]; then
  warn "Diretório $INSTALL_DIR já existe. Atualizando..."
  cd "$INSTALL_DIR"
  git pull origin main
else
  git clone https://github.com/grupoliber/liberdiscovery.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

log "Repositório clonado em $INSTALL_DIR"

# Criar .env do backend
if [ ! -f "$INSTALL_DIR/backend/.env" ]; then
  cp "$INSTALL_DIR/backend/.env.example" "$INSTALL_DIR/backend/.env"
  log "Arquivo .env criado (edite depois se necessário)"
fi

# Subir containers
echo ""
echo "Subindo containers Docker (pode levar alguns minutos na primeira vez)..."
docker compose pull
docker compose up -d --build

log "Containers iniciados"

# ============================================
# 7. Verificar instalação
# ============================================
echo ""
echo "--- 7/7 Verificando instalação ---"

# Aguardar serviços subirem
echo "Aguardando serviços iniciarem (60s)..."
sleep 60

# Checar containers
RUNNING=$(docker compose ps --format "{{.Name}} {{.Status}}" | grep -c "Up" || true)
TOTAL=$(docker compose ps --format "{{.Name}}" | wc -l)

if [ "$RUNNING" -ge 4 ]; then
  log "$RUNNING/$TOTAL containers rodando"
else
  warn "Apenas $RUNNING/$TOTAL containers rodando. Verifique: docker compose logs"
fi

# Pegar IP público
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "SEU_IP")

# ============================================
# Resumo final
# ============================================
echo ""
echo "============================================"
echo -e "  ${GREEN}LiberDiscovery instalado com sucesso!${NC}"
echo "============================================"
echo ""
echo "  Acesse:"
echo ""
echo "  LiberDiscovery:  http://$PUBLIC_IP:5173"
echo "  API Docs:        http://$PUBLIC_IP:8000/docs"
echo "  Zabbix Web:      http://$PUBLIC_IP:8080"
echo ""
echo "  Login Zabbix padrão:"
echo "    Usuário: Admin"
echo "    Senha:   zabbix"
echo ""
echo "  Comandos úteis:"
echo "    cd /opt/liberdiscovery"
echo "    docker compose logs -f          # Ver logs"
echo "    docker compose ps               # Status"
echo "    docker compose restart           # Reiniciar tudo"
echo "    docker compose down              # Parar tudo"
echo "    docker compose up -d --build     # Rebuild e subir"
echo "    git pull && docker compose up -d --build  # Atualizar"
echo ""
echo "  Firewall (ufw):"
echo "    ufw status                      # Ver regras"
echo "    ufw allow PORTA/tcp             # Abrir porta"
echo ""
echo "  Diretório: /opt/liberdiscovery"
echo ""
echo "============================================"
echo ""
