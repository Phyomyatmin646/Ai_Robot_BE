from .base import LLMProvider, EmbeddingProvider
from ..core.config import settings
from ..core.logger import logger
from typing import List, Dict, Any, AsyncGenerator, Optional
import os
from google import genai
from google.genai import types


class GeminiProvider(LLMProvider, EmbeddingProvider):
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self._available = bool(self.api_key and len(self.api_key) > 10)
        self.client: Optional[genai.Client] = None

        if self._available:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to configure Google GenAI client: {e}")
                self._available = False

    @property
    def name(self) -> str:
        return "gemini"

    async def is_available(self) -> bool:
        return self._available

    async def generate_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
        temperature: float = 0.7,
        max_tokens: int = 800,
    ) -> str:
        if not self._available or not self.client:
            return f"[Gemini Mock Response]: I received your message: '{prompt}'."

        try:
            config = types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=temperature,
                max_output_tokens=max_tokens,
            )
            response = await self.client.aio.models.generate_content(
                model=settings.FAST_MODEL,
                contents=prompt,
                config=config,
            )
            return response.text or ""
        except Exception as e:
            logger.error(f"Gemini generate_response error: {e}")
            return "I apologize, I encountered an issue processing your request."

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        if not self._available or not self.client:
            words = f"[Gemini Mock Stream]: Hello! Response to '{prompt}'.".split()
            for w in words:
                yield w + " "
            return

        try:
            config = types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=temperature,
            )
            async for chunk in await self.client.aio.models.generate_content_stream(
                model=settings.FAST_MODEL,
                contents=prompt,
                config=config,
            ):
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            logger.error(f"Gemini stream error: {e}")
            yield "Error in AI generation stream."

    async def embed(self, text: str) -> List[float]:
        if not self._available or not self.client:
            return [0.01 * (i % 50) for i in range(768)]

        try:
            result = await self.client.aio.models.embed_content(
                model=settings.EMBEDDING_MODEL,
                contents=text,
            )
            return result.embeddings[0].values
        except Exception as e:
            logger.error(f"Gemini embedding error: {e}")
            return [0.01 * (i % 50) for i in range(768)]

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        if not self._available or not self.client:
            return [[0.01 * (i % 50) for i in range(768)] for _ in texts]

        try:
            result = await self.client.aio.models.embed_content(
                model=settings.EMBEDDING_MODEL,
                contents=texts,
            )
            return [e.values for e in result.embeddings]
        except Exception as e:
            logger.error(f"Gemini batch embedding error: {e}")
            return [[0.01 * (i % 50) for i in range(768)] for _ in texts]

    async def transcribe(self, audio_bytes: bytes, mime_type: str = "audio/wav", language: str = "en") -> str:
        if not self._available or not self.client:
            return "[Gemini Mock STT]: Simulated speech transcription."

        try:
            part = types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)
            prompt = f"Transcribe the spoken words in this audio exactly as said. Language: {language}. Output ONLY the raw transcription without any commentary or quotation marks."
            response = await self.client.aio.models.generate_content(
                model=settings.FAST_MODEL,
                contents=[part, prompt],
            )
            return (response.text or "").strip()
        except Exception as e:
            logger.error(f"Gemini transcription error: {e}")
            return ""


gemini_provider = GeminiProvider()

