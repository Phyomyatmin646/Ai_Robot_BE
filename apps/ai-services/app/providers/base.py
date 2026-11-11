from abc import ABC, abstractmethod
from typing import List, Dict, Any, AsyncGenerator, Optional


class AIProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    async def is_available(self) -> bool:
        pass


class LLMProvider(AIProvider):
    @abstractmethod
    async def generate_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
        temperature: float = 0.7,
        max_tokens: int = 800,
    ) -> str:
        pass

    @abstractmethod
    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        pass


class STTProvider(AIProvider):
    @abstractmethod
    async def transcribe(self, audio_data: bytes, language: str = "en") -> str:
        pass


class TTSProvider(AIProvider):
    @abstractmethod
    async def synthesize(self, text: str, voice: str = "default", speed: float = 1.0) -> bytes:
        pass

    @abstractmethod
    async def synthesize_stream(self, text: str, voice: str = "default") -> AsyncGenerator[bytes, None]:
        pass


class EmbeddingProvider(AIProvider):
    @abstractmethod
    async def embed(self, text: str) -> List[float]:
        pass

    @abstractmethod
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        pass
