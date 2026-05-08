from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Calculation Engine"
    debug: bool = False
    api_version: str = "0.1.0"

    database_url: str = "postgresql://user:password@localhost:5432/calculations"

    # Units configuration
    default_unit_system: str = "SI"
    supported_unit_systems: list = ["SI", "Imperial", "Custom"]

    # Template configuration
    templates_path: str = "templates"

    # Calculation configuration
    max_calculation_variables: int = 1000
    max_calculation_depth: int = 100

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings():
    return Settings()
