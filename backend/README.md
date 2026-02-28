# DorAImon Backend (FastAPI + LangGraph)

Python backend scaffold with:
- `POST /v1/process` for text/code processing
- `WS /v1/voice/stream` for streaming voice chunks
- LangGraph workflow:
  - `ingest -> classify_intent -> route -> call_mistral_model -> postprocess -> moderate -> return_response -> log_trace`

## 1. Setup
```bash
cd /Users/hikaru/project/42/doraimon_backend
python3.10 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Set `MISTRAL_API_KEY` in `.env`.

## 2. Run
```bash
uvicorn app:app --reload --port 8000
```

## 3. Health
```bash
curl http://127.0.0.1:8000/health/live
curl http://127.0.0.1:8000/health/ready
```

## 4. Process API examples
Translate route example:
```bash
curl -X POST http://127.0.0.1:8000/v1/process \
  -H "Content-Type: application/json" \
  -d '{"input_type":"text","content":"こんにちは","target_language":"English","session_id":"demo-1"}'
```

Code support example:
```bash
curl -X POST http://127.0.0.1:8000/v1/process \
  -H "Content-Type: application/json" \
  -d '{"input_type":"code","content":"TypeError: NoneType is not subscriptable","target_language":"Japanese","session_id":"demo-2"}'
```

## 5. Voice WebSocket example
You can stream chunks and then send `final=true`:
```json
{"chunk":"hello this is a test", "final":false, "target_language":"ja", "session_id":"voice-1"}
{"chunk":"please summarize", "final":true, "target_language":"ja", "session_id":"voice-1"}
```

## 6. Folder layout
```text
doraimon_backend/
  app.py
  src/
    config.py
    mistral_client.py
    schemas.py
    workflow.py
```

## 7. Docker run
```bash
cd /Users/hikaru/project/42/doraimon_backend
cp .env.example .env
# set MISTRAL_API_KEY in .env
docker compose up --build
```

API will be available at `http://localhost:8000`.




If your old `.venv` was created with Python 3.9, recreate it with:
```bash
make reset-venv
```


## 8. Image translate API test
Use a separate script (kept separate from `test.py`):
```bash
python image_translate_test.py \
  --base-url http://localhost:8000 \
  --image-path "./スクリーンショット 2026-02-28 17.08.14.png" \
  --target-language English \
  --model pixtral-large-latest
```


## 9. Shared JSON config mode
Both tests now read settings from `request_config.json` (base URL, model, prompt, image path).

Run process test:
```bash
python test.py --config request_config.json
```

Run image translate test:
```bash
python image_translate_test.py --config request_config.json
```


## 10. Unified image/audio backend flow
New endpoint: `POST /v1/process-unified`

Request format:
```json
{
  "process": {
    "base_url": "http://localhost:8000",
    "image_path": "./path/to/screenshot.png",
    "target_language": "English",
    "todo": ""
  }
}
```

Rules implemented:
- Extract text from image with `MISTRAL_OCR_MODEL` (`mistral-ocr-latest` by default)
- Or transcribe audio file with `MISTRAL_AUDIO_MODEL`
- Analyze text intent with `MISTRAL_TEXT_MODEL`
- Branch:
  - Code request -> `MISTRAL_CODE_MODEL` and return JSON with code + explanation
  - Special model instruction -> run selected model
  - Default/no instruction -> translation flow and return JSON keys:
    - `Text Coordination`, `Context`, `Content`, `Language`
- If `target_language` is omitted, source language is kept

Test:
```bash
python unified_process_test.py --config request_config.json
```
