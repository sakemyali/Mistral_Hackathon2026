from typing import Literal, Optional

from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    input_type: Literal["text", "code", "audio"]
    content: str = Field(min_length=1)
    target_language: str = "ja"
    session_id: str = "default-session"


class ProcessResponse(BaseModel):
    result: str
    model_used: str
    trace_id: str
    latency_ms: int
    route: str
    intent: str


class VoiceChunk(BaseModel):
    chunk: str
    final: bool = False
    target_language: Optional[str] = None
    session_id: Optional[str] = None


class ImageTranslateRequest(BaseModel):
    image_base64: str = Field(min_length=1, description="Base64-encoded image bytes")
    target_language: str = "English"
    model: Optional[str] = None
    prompt: Optional[str] = None


class ImageTranslateResponse(BaseModel):
    result: str
    model_used: str


class UnifiedProcessPayload(BaseModel):
    base_url: Optional[str] = None
    image_path: Optional[str] = None
    audio_path: Optional[str] = None
    target_language: Optional[str] = None
    todo: Optional[str] = None


class UnifiedProcessRequest(BaseModel):
    process: UnifiedProcessPayload


class UnifiedProcessResponse(BaseModel):
    process: dict
