import os
from dotenv import load_dotenv

load_dotenv()

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
OCR_FPS = float(os.getenv("OCR_FPS", "2"))
VISION_FPS = float(os.getenv("VISION_FPS", "0.25"))
CLASSIFIER_FPS = float(os.getenv("CLASSIFIER_FPS", "0.5"))
CAPTURE_MONITOR = int(os.getenv("CAPTURE_MONITOR", "1"))
WS_PORT = int(os.getenv("WS_PORT", "8000"))

# Mistral API (all models via Mistral cloud)
MISTRAL_API_BASE = "https://api.mistral.ai/v1"

# Pixtral-12B for vision analysis
PIXTRAL_MODEL = "pixtral-12b-2409"

# Ministral 3B for classification & translation
MINISTRAL_MODEL = os.getenv("MINISTRAL_MODEL", "ministral-3b-latest")

# ElevenLabs TTS
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
VOICE_ID_JP = os.getenv("VOICE_ID_JP", "pFZP5JQG7iQjIQuC4Bku")
VOICE_ID_EN = os.getenv("VOICE_ID_EN", "JBFqnCBsd6RMkjVDRZzb")
VOICE_MODE = os.getenv("VOICE_MODE", "auto").lower()  # silent | voice | auto

# Devstral model for code analysis
DEVSTRAL_MODEL = os.getenv("DEVSTRAL_MODEL", "codestral-latest")

# Weights & Biases (optional)
WANDB_ENABLED = os.getenv("WANDB_ENABLED", "false").lower() in ("true", "1", "yes")
WANDB_PROJECT = os.getenv("WANDB_PROJECT", "dorAImon")
WANDB_RUN_NAME = os.getenv("WANDB_RUN_NAME", "")
