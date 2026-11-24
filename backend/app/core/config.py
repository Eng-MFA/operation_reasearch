import os
from typing import List

class Settings:
    PROJECT_NAME: str = "OptiVerse - Universal Operations Research Platform"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./optiverse.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-optiverse-key-change-in-prod")
    CORS_ORIGINS: List[str] = ["*"]
    SOLVER_TIMEOUT_DEFAULT_SEC: int = 60
    MAX_ITERATIONS_DEFAULT: int = 10000

settings = Settings()
