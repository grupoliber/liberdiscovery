"""
LiberDiscovery - Router de Licença
Endpoints para consulta e revalidação do status da licença.
"""

from fastapi import APIRouter

from app.services.license import license_service

router = APIRouter(prefix="/license")


@router.get("/status")
async def get_license_status():
    """Retorna status atual da licença (usa cache 24h)."""
    status = await license_service.get_status()
    return status.to_dict()


@router.post("/revalidate")
async def revalidate_license():
    """Força revalidação da licença com o servidor central."""
    await license_service.invalidate_cache()
    status = await license_service.validate(force=True)
    return status.to_dict()
