from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    APP_NAME: str = "AI Robot Microservice"
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    DEBUG: bool = False

    # AI API Keys
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY", "")
    ELEVENLABS_API_KEY: Optional[str] = os.getenv("ELEVENLABS_API_KEY", "")

    # Models
    FAST_MODEL: str = os.getenv("FAST_MODEL", "gemini-2.0-flash")
    THINKING_MODEL: str = os.getenv("THINKING_MODEL", "gemini-2.0-pro")
    VOICE_MODEL: str = os.getenv("VOICE_MODEL", "gemini-2.0-flash-live")
    EMBEDDING_MODEL: str = "text-embedding-004"

    # Audio
    AUDIO_SAMPLE_RATE: int = 16000
    DEFAULT_LANGUAGE: str = "en"
    SUPPORTED_LANGUAGES: List[str] = ["en", "my"]

    # CORS
    CORS_ORIGINS: List[str] = ["*"]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
