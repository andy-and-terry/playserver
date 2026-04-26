from functools import lru_cache

from pydantic import Field, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Core
    API_TOKEN: str = Field(
        default="changeme",
        validation_alias=AliasChoices("DGX_API_TOKEN", "API_TOKEN"),
    )
    OLLAMA_BASE_URL: str = ""
    DATA_DIR: str = "./data"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    MAX_UPLOAD_MB: int = 200

    # Firewall
    FIREWALL_ENABLED: bool = True
    ALLOWED_IPS: str = ""  # comma-separated CIDRs; empty = allow all
    BLOCKED_IPS: str = ""  # comma-separated IPs/CIDRs to block
    RATE_LIMIT_PER_MINUTE: int = 60  # per-IP; 0 = disabled


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
