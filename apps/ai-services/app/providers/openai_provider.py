from .base import LLMProvider, STTProvider
from ..core.config import settings
from ..core.logger import logger
from typing import List, Dict, Any, AsyncGenerator, Optional
import os


class OpenAIProvider(LLMProvider, STTProvider):
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self._available = bool(self.api_key and len(self.api_key) > 10)

        if self._available:
            try:
                from openai import AsyncOpenAI
                self.client = AsyncOpenAI(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI client: {e}")
                self._available = False

    @property
    def name(self) -> str:
        return "openai"

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
            return f"[OpenAI Mock]: Received '{prompt}'"

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": prompt})

        response = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        if not self._available:
            yield f"[OpenAI Mock Stream for '{prompt}']"
            return

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        stream = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            stream=True,
            temperature=temperature,
        )
        async for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                yield content

    async def transcribe(self, audio_data: bytes, language: str = "en") -> str:
        if not self._available:
            return "This is a transcribed mock text from audio input."

        import io
        audio_file = io.BytesIO(audio_data)
        audio_file.name = "audio.wav"

        transcript = await self.client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language=language,
        )
        return transcript.text


openai_provider = OpenAIProvider()
