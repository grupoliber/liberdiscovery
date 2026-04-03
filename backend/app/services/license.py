"""
LiberDiscovery - Serviço de Licença
Integração com o servidor centralizado de licenças Libernet (ispacs.libernet.com.br).
"""

import httpx
import socket
import logging
from datetime import datetime

from app.core.config import settings
from app.services.cache import cache

logger = logging.getLogger(__name__)

LICENSE_SERVER = "https://ispacs.libernet.com.br"
PRODUCT_SLUG = "liberdiscovery"
CACHE_KEY = "license:status"
CACHE_TTL = 86400  # 24 horas


class LicenseStatus:
    """Resultado da validação de licença."""

    def __init__(self, data: dict | None = None):
        if data:
            self.valid = data.get("valid", False)
            self.status = data.get("status", "unknown")  # active, inactive, blocked, expired
            self.customer = data.get("customer", {})
            self.product = data.get("product", {})
            self.permissions = data.get("permissions", {})
            self.message = data.get("message", "")
            self.expires_at = data.get("expires_at")
            self.raw = data
        else:
            # Fallback quando não consegue validar
            self.valid = False
            self.status = "unknown"
            self.customer = {}
            self.product = {}
            self.permissions = {}
            self.message = "Não foi possível validar a licença"
            self.expires_at = None
            self.raw = {}

    @property
    def is_active(self) -> bool:
        return self.status == "active"

    @property
    def is_blocked(self) -> bool:
        return self.status == "blocked"

    @property
    def can_write(self) -> bool:
        return self.permissions.get("write", 1) == 1

    @property
    def can_read(self) -> bool:
        """Se bloqueado, não pode nem ler."""
        return not self.is_blocked

    def to_dict(self) -> dict:
        return {
            "valid": self.valid,
            "status": self.status,
            "customer": self.customer,
            "product": self.product,
            "permissions": self.permissions,
            "message": self.message,
            "expires_at": self.expires_at,
            "is_active": self.is_active,
            "is_blocked": self.is_blocked,
            "can_write": self.can_write,
            "can_read": self.can_read,
        }


class LicenseService:
    """Serviço de validação de licença com o servidor Libernet."""

    def __init__(self):
        self._status: LicenseStatus | None = None

    def _get_hostname(self) -> str:
        """Obtém hostname da máquina para validação."""
        try:
            return socket.gethostname()
        except Exception:
            return "unknown"

    async def validate(self, force: bool = False) -> LicenseStatus:
        """
        Valida licença com o servidor central.
        Usa cache Redis de 24h para não sobrecarregar o servidor.
        """
        license_key = settings.license_key

        # Sem chave configurada
        if not license_key:
            self._status = LicenseStatus()
            self._status.message = "LICENSE_KEY não configurada"
            self._status.status = "inactive"
            return self._status

        # Verifica cache (24h)
        if not force:
            cached = await cache.get(CACHE_KEY)
            if cached:
                self._status = LicenseStatus(cached)
                logger.debug("Licença obtida do cache: %s", self._status.status)
                return self._status

        # Valida com servidor central
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    f"{LICENSE_SERVER}/api/license/validate",
                    json={
                        "license_key": license_key,
                        "product": PRODUCT_SLUG,
                        "hostname": self._get_hostname(),
                    },
                )

                if response.status_code == 200:
                    data = response.json()
                    self._status = LicenseStatus(data)
                    # Cache por 24h
                    await cache.set(CACHE_KEY, data, ttl=CACHE_TTL)
                    logger.info("Licença validada: status=%s", self._status.status)
                else:
                    logger.warning(
                        "Servidor de licença retornou %s: %s",
                        response.status_code,
                        response.text[:200],
                    )
                    # Se já tinha um status em cache, mantém
                    if self._status is None:
                        self._status = LicenseStatus()
                        self._status.message = f"Erro ao validar: HTTP {response.status_code}"

        except httpx.TimeoutException:
            logger.warning("Timeout ao conectar com servidor de licenças")
            if self._status is None:
                self._status = LicenseStatus()
                self._status.message = "Timeout ao conectar com servidor de licenças"
        except Exception as e:
            logger.warning("Erro ao validar licença: %s", str(e))
            if self._status is None:
                self._status = LicenseStatus()
                self._status.message = f"Erro de conexão: {str(e)}"

        return self._status

    async def get_status(self) -> LicenseStatus:
        """Retorna status atual da licença (com cache)."""
        if self._status is None:
            return await self.validate()
        return self._status

    async def invalidate_cache(self):
        """Força revalidação na próxima consulta."""
        await cache.delete(CACHE_KEY)
        self._status = None


# Singleton
license_service = LicenseService()
