from .base import TTSProvider
from ..core.config import settings
from ..core.logger import logger
from typing import AsyncGenerator
import os


class ElevenLabsProvider(TTSProvider):
    def __init__(self):
        self.api_key = settings.ELEVENLABS_API_KEY
        self._available = bool(self.api_key and len(self.api_key) > 10)

        if self._available:
            try:
                from elevenlabs.client import AsyncElevenLabs
                self.client = AsyncElevenLabs(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to initialize ElevenLabs client: {e}")
                self._available = False

    @property
    def name(self) -> str:
        return "elevenlabs"

    async def is_available(self) -> bool:
        return self._available

    async def synthesize(self, text: str, voice: str = "Rachel", speed: float = 1.0) -> bytes:
        if not self._available:
            # Generate silent PCM header/bytes as mock audio
            return b"\x00" * 3200  # 0.1s of 16kHz 16-bit mono PCM

        try:
            audio_generator = await self.client.generate(
                text=text,
                voice=voice,
                model="eleven_multilingual_v2",
            )
            chunks = []
            async for chunk in audio_generator:
                chunks.append(chunk)
            return b"".join(chunks)
        except Exception as e:
            logger.error(f"ElevenLabs TTS error: {e}")
            return b"\x00" * 3200

    async def synthesize_stream(self, text: str, voice: str = "Rachel") -> AsyncGenerator[bytes, None]:
        if not self._available:
            yield b"\x00" * 1600
            return

        try:
            audio_stream = await self.client.generate(
                text=text,
                voice=voice,
                model="eleven_multilingual_v2",
                stream=True,
            )
            async for chunk in audio_stream:
                yield chunk
        except Exception as e:
            logger.error(f"ElevenLabs TTS stream error: {e}")
            yield b"\x00" * 1600


elevenlabs_provider = ElevenLabsProvider()
