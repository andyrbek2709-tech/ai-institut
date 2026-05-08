"""Application configuration."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings from environment."""

    # Database
    database_url: str = "postgresql://localhost/calculations"

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    debug: bool = False

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Units
    default_temperature_unit: str = "kelvin"
    default_pressure_unit: str = "pascal"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
