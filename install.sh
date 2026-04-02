#!/bin/bash
# LiberDiscovery - Script de Instalação
# https://docs.libernet.com.br/liberdiscovery

set -e

echo "============================================"
echo "  LiberDiscovery - Instalação"
echo "  Network Monitoring System para ISPs"
echo "============================================"
echo ""

# Verificar requisitos
check_requirements() {
    echo "[*] Verificando requisitos..."

    if ! command -v docker &> /dev/null; then
        echo "[!] Docker não encontrado. Instalando..."
        curl -fsSL https://get.docker.com | sh
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo "[!] Docker Compose não encontrado. Instalando..."
        apt-get install -y docker-compose-plugin
    fi

    echo "[OK] Requisitos atendidos."
}

# Configurar diretórios
setup_directories() {
    echo "[*] Configurando diretórios..."
    mkdir -p /opt/liberdiscovery
    cp -r . /opt/liberdiscovery/
    cd /opt/liberdiscovery
    echo "[OK] Diretórios configurados."
}

# Iniciar serviços
start_services() {
    echo "[*] Iniciando serviços..."
    docker compose up -d
    echo "[OK] Serviços iniciados."
}

# Verificar instalação
verify_installation() {
    echo "[*] Verificando instalação..."
    sleep 5
    if curl -s http://localhost:8000/docs > /dev/null 2>&1; then
        echo "[OK] LiberDiscovery está rodando!"
        echo ""
        echo "  Dashboard: http://localhost:8000"
        echo "  API Docs:  http://localhost:8000/docs"
    else
        echo "[!] Aguardando serviços iniciarem..."
        echo "    Verifique com: docker compose logs"
    fi
}

# Execução
check_requirements
setup_directories
start_services
verify_installation

echo ""
echo "============================================"
echo "  Instalação concluída!"
echo "  Suporte: suporte@libernet.com.br"
echo "============================================"
