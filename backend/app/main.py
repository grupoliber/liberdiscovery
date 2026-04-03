"""
LiberDiscovery - API Principal
FastAPI middleware entre o frontend React e a Zabbix API.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.services.zabbix_client import zabbix
from app.services.cache import cache
from app.services.license import license_service
from app.middleware.license_check import LicenseCheckMiddleware
from app.routers import devices, alerts, metrics, topology, dashboard, sensors, discovery, license

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerencia conexões no startup/shutdown."""
    # Startup
    await cache.connect()
    await zabbix.login()

    # Valida licença no startup
    try:
        lic = await license_service.validate()
        logger.info("Licença: status=%s, active=%s", lic.status, lic.is_active)
        if not lic.is_active:
            logger.warning("Licença NÃO está ativa: %s", lic.message)
    except Exception as e:
        logger.warning("Falha ao validar licença no startup: %s", str(e))

    yield
    # Shutdown
    await zabbix.logout()
    await cache.disconnect()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Network Monitoring System para ISPs - Powered by Zabbix",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# License middleware (após CORS para não bloquear preflight)
app.add_middleware(LicenseCheckMiddleware)

# Routers
app.include_router(dashboard.router, prefix="/api/v1", tags=["Dashboard"])
app.include_router(devices.router, prefix="/api/v1", tags=["Dispositivos"])
app.include_router(alerts.router, prefix="/api/v1", tags=["Alertas"])
app.include_router(metrics.router, prefix="/api/v1", tags=["Métricas"])
app.include_router(topology.router, prefix="/api/v1", tags=["Topologia"])
app.include_router(sensors.router, prefix="/api/v1", tags=["Sensores"])
app.include_router(discovery.router, prefix="/api/v1", tags=["Discovery"])
app.include_router(license.router, prefix="/api/v1", tags=["Licença"])


@app.get("/api/v1/health")
async def health_check():
    """Verifica saúde do serviço."""
    return {"status": "ok", "version": settings.app_version}
