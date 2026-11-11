from .base import LLMProvider, EmbeddingProvider
from ..core.config import settings
from ..core.logger import logger
from typing import List, Dict, Any, AsyncGenerator, Optional
import os


class GeminiProvider(LLMProvider, EmbeddingProvider):
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self._available = bool(self.api_key and len(self.api_key) > 10)

        if self._available:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                self.client = genai
            except Exception as e:
                logger.error(f"Failed to configure Google Generative AI: {e}")
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
        if not self._available:
            return f"[Gemini Mock Response]: I received your message: '{prompt}'."

        try:
            model = self.client.GenerativeModel(
                model_name=settings.FAST_MODEL,
                system_instruction=system_prompt,
                generation_config={"temperature": temperature, "max_output_tokens": max_tokens},
            )
            response = await model.generate_content_async(prompt)
            return response.text
        except Exception as e:
            logger.error(f"Gemini generate_response error: {e}")
            return f"I apologize, I encountered an issue processing your request."

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        if not self._available:
            words = f"[Gemini Mock Stream]: Hello! Response to '{prompt}'.".split()
            for w in words:
                yield w + " "
            return

        try:
            model = self.client.GenerativeModel(
                model_name=settings.FAST_MODEL,
                system_instruction=system_prompt,
                generation_config={"temperature": temperature},
            )
            response = await model.generate_content_async(prompt, stream=True)
            async for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            logger.error(f"Gemini stream error: {e}")
            yield "Error in AI generation stream."

    async def embed(self, text: str) -> List[float]:
        if not self._available:
            # Deterministic mock 768-dim embedding
            return [0.01 * (i % 50) for i in range(768)]

        try:
            result = self.client.embed_content(
                model=f"models/{settings.EMBEDDING_MODEL}",
                content=text,
                task_type="retrieval_document",
            )
            return result["embedding"]
        except Exception as e:
            logger.error(f"Gemini embedding error: {e}")
            return [0.01 * (i % 50) for i in range(768)]

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        if not self._available:
            return [[0.01 * (i % 50) for i in range(768)] for _ in texts]

        try:
            result = self.client.embed_content(
                model=f"models/{settings.EMBEDDING_MODEL}",
                content=texts,
                task_type="retrieval_document",
            )
            return result["embedding"]
        except Exception as e:
            logger.error(f"Gemini batch embedding error: {e}")
            return [[0.01 * (i % 50) for i in range(768)] for _ in texts]


gemini_provider = GeminiProvider()
