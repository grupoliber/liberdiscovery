"""
LiberDiscovery - Router de Licença
Endpoints para consulta, ativação e revalidação do status da licença.
"""

import os
import re
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.services.license import license_service

router = APIRouter(prefix="/license")

# Caminho do .env (raiz do projeto no container ou host)
ENV_FILE = Path("/app/.env")
HOST_ENV_FILE = Path("/opt/liberdiscovery/.env")


class LicenseKeyInput(BaseModel):
    license_key: str


def _get_env_path() -> Path:
    """Retorna o caminho do .env existente."""
    for p in [HOST_ENV_FILE, ENV_FILE, Path(".env")]:
        if p.exists():
            return p
    return HOST_ENV_FILE


def _update_env_file(key: str, value: str):
    """Atualiza ou adiciona uma variável no arquivo .env."""
    env_path = _get_env_path()

    if env_path.exists():
        content = env_path.read_text()
        pattern = rf'^{re.escape(key)}=.*$'
        if re.search(pattern, content, re.MULTILINE):
            content = re.sub(pattern, f'{key}={value}', content, flags=re.MULTILINE)
        else:
            content = content.rstrip('\n') + f'\n{key}={value}\n'
    else:
        content = f'{key}={value}\n'

    env_path.write_text(content)


@router.get("/status")
async def get_license_status():
    """Retorna status atual da licença (usa cache 24h)."""
    status = await license_service.get_status()
    return status.to_dict()


@router.post("/activate")
async def activate_license(data: LicenseKeyInput):
    """Ativa uma chave de licença: salva no .env, atualiza config e revalida."""
    key = data.license_key.strip()

    if not key:
        raise HTTPException(status_code=400, detail="Chave de licença não pode ser vazia")

    # Atualizar settings em memória
    settings.license_key = key

    # Salvar no .env para persistir entre restarts
    try:
        _update_env_file("LICENSE_KEY", key)
    except Exception as e:
        # Não bloqueia se não conseguir gravar — a chave já está em memória
        pass

    # Invalidar cache e revalidar
    await license_service.invalidate_cache()
    status = await license_service.validate(force=True)

    return {
        "saved": True,
        "license": status.to_dict(),
    }


@router.post("/revalidate")
async def revalidate_license():
    """Força revalidação da licença com o servidor central."""
    await license_service.invalidate_cache()
    status = await license_service.validate(force=True)
    return status.to_dict()
