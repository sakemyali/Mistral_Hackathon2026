# doraimon_backend

## Run
```bash
cd /Users/hikaru/project/42/doraimon_backend
source .venv/bin/activate
make main
```

## Input
`request_config.json`

```json
{
  "process": {
    "base_url": "http://localhost:8000",
    "image_path": "./your_image.png",
    "target_language": "English"
  }
}
```

## Output
- `ocr_output.json`
  - `Langrage`
  - `Context`
- `pixtral_output.json`
  - `Text Coordination`
  - `Context`
  - `Content`
  - `Langrage`
