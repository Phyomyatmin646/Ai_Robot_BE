from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from ..providers.gemini_provider import gemini_provider
from ..providers.openai_provider import openai_provider
from ..providers.elevenlabs_provider import elevenlabs_provider
from ..core.logger import logger

router = APIRouter(prefix="/api/v1")


class ChatRequest(BaseModel):
    prompt: str
    system_prompt: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = None
    temperature: float = 0.7
    max_tokens: int = 800
    model_type: str = "fast"  # 'fast' or 'thinking'


class EmbeddingRequest(BaseModel):
    text: str


class BatchEmbeddingRequest(BaseModel):
    texts: List[str]


class TTSRequest(BaseModel):
    text: str
    voice: str = "Rachel"
    speed: float = 1.0


@router.post("/chat")
async def chat_completion(request: ChatRequest):
    try:
        response = await gemini_provider.generate_response(
            prompt=request.prompt,
            system_prompt=request.system_prompt,
            history=request.history,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
        return {"success": True, "text": response}
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    async def event_generator():
        try:
            async for chunk in gemini_provider.generate_stream(
                prompt=request.prompt,
                system_prompt=request.system_prompt,
                history=request.history,
                temperature=request.temperature,
            ):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: [ERROR: {str(e)}]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/embeddings")
async def get_embedding(request: EmbeddingRequest):
    embedding = await gemini_provider.embed(request.text)
    return {"embedding": embedding, "dimension": len(embedding)}


@router.post("/embeddings/batch")
async def get_batch_embeddings(request: BatchEmbeddingRequest):
    embeddings = await gemini_provider.embed_batch(request.texts)
    return {"embeddings": embeddings, "count": len(embeddings)}


@router.post("/tts")
async def synthesize_speech(request: TTSRequest):
    audio_bytes = await elevenlabs_provider.synthesize(request.text, request.voice, request.speed)
    return StreamingResponse(iter([audio_bytes]), media_type="audio/mpeg")


@router.post("/stt")
async def transcribe_speech(file: UploadFile = File(...), language: str = "en"):
    content = await file.read()
    transcript = await openai_provider.transcribe(content, language)
    return {"text": transcript}
