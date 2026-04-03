"""
LiberDiscovery - Configurações do Backend
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    app_name: str = "LiberDiscovery"
    app_version: str = "1.0.0"
    debug: bool = True

    # Zabbix
    zabbix_url: str = "http://localhost:8080/api_jsonrpc.php"
    zabbix_user: str = "Admin"
    zabbix_password: str = "zabbix"

    # Redis (cache)
    redis_url: str = "redis://localhost:6379"
    cache_ttl: int = 30  # segundos

    # Licença Libernet
    license_key: str = ""

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"


settings = Settings()
