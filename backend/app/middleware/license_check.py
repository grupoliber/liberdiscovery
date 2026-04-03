"""
LiberDiscovery - License Check Middleware
Bloqueia operações com base no status da licença:
- status=blocked → bloqueia TODO acesso (403)
- permissions.write=0 → bloqueia POST/PUT/DELETE (403)
- status!=active → permite leitura mas frontend mostra banner
"""

import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.services.license import license_service

logger = logging.getLogger(__name__)

# Rotas que nunca são bloqueadas (health, licença)
EXEMPT_PATHS = [
    "/api/v1/health",
    "/api/v1/license/status",
    "/api/v1/license/revalidate",
    "/docs",
    "/openapi.json",
]

WRITE_METHODS = {"POST", "PUT", "DELETE", "PATCH"}


class LicenseCheckMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Rotas isentas
        if any(path.startswith(p) for p in EXEMPT_PATHS):
            return await call_next(request)

        # Só verifica rotas da API
        if not path.startswith("/api/"):
            return await call_next(request)

        # Obtém status da licença (usa cache)
        try:
            status = await license_service.get_status()
        except Exception as e:
            logger.error("Erro ao verificar licença: %s", str(e))
            # Em caso de erro, permite acesso (fail-open)
            return await call_next(request)

        # Bloqueado → nega tudo
        if status.is_blocked:
            return JSONResponse(
                status_code=403,
                content={
                    "detail": "Licença bloqueada. Entre em contato com o suporte Libernet.",
                    "license_status": "blocked",
                },
            )

        # Sem permissão de escrita → bloqueia métodos de escrita
        if request.method in WRITE_METHODS and not status.can_write:
            return JSONResponse(
                status_code=403,
                content={
                    "detail": "Licença sem permissão de escrita. Operação bloqueada.",
                    "license_status": status.status,
                    "permission": "write_denied",
                },
            )

        return await call_next(request)
