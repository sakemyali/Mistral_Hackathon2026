import os

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")

DEFAULT_TEXT_MODEL = os.getenv("MISTRAL_TEXT_MODEL", "mistral-medium-latest")
DEFAULT_CODE_MODEL = os.getenv("MISTRAL_CODE_MODEL", "devstral-latest")
DEFAULT_AUDIO_MODEL = os.getenv("MISTRAL_AUDIO_MODEL", "voxtral-mini-transcribe-latest")
DEFAULT_IMAGE_MODEL = os.getenv("MISTRAL_IMAGE_MODEL", "pixtral-large-latest")
DEFAULT_MODERATION_MODEL = os.getenv("MISTRAL_MODERATION_MODEL", "mistral-moderation-latest")

CONFIDENCE_THRESHOLD = float(os.getenv("INTENT_CONFIDENCE_THRESHOLD", "0.7"))
