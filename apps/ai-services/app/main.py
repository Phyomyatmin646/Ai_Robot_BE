from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.logger import logger
from .api.routes import router
import time

app = FastAPI(
    title="AI Voice Assistant Robot Platform — AI Microservices",
    description="Python FastAPI service handling RAG, Embeddings, STT/TTS cascade, and AI Provider Orchestration",
    version="1.0.0",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "ai-services",
        "timestamp": time.time(),
        "providers": {
            "gemini": bool(settings.GEMINI_API_KEY),
            "openai": bool(settings.OPENAI_API_KEY),
            "elevenlabs": bool(settings.ELEVENLABS_API_KEY),
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
