import json
import os
from typing import Any, Dict, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ValidationError
from mistralai import Mistral


app: FastAPI = FastAPI()


class CodeItem(BaseModel):
    """
    Input schema for the code analysis request.

    Attributes:
        text_coordination: The spatial coordinates of the text.
        context: The surrounding context or file information.
        content: The actual code to analyze.
        language: The target language for the advice output.
    """
    text_coordination: Dict[str, int]
    context: str
    content: str
    language: str


def build_analysis_prompt(item: CodeItem) -> str:
    """
    Builds the prompt string for the LLM to analyze code.

    Args:
        item: The input item containing code and context.

    Returns:
        A formatted string instructing the LLM to provide advice.
    """
    prompt: str = (
        "You are an expert programmer and code reviewer.\n"
        f"Context regarding this code: {item.context}\n"
        f"Please analyze the following code and provide advice "
        f"or point out potential bugs in {item.language}.\n"
        "CRITICAL INSTRUCTION: You must respond ONLY with a valid "
        "JSON object.\n"
        'The JSON must have a single key named "advice" containing '
        'your review comment as a string. Do not add any other text.\n'
        f"Code Content:\n{item.content}"
    )
    return prompt


@app.websocket("/ws/advise")
async def websocket_advise(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for real-time code analysis.

    Args:
        websocket: The WebSocket connection object.
    """
    await websocket.accept()
    api_key: str = os.getenv("MISTRAL_API_KEY", "")

    if not api_key:
        await websocket.send_text("Error: API key is missing.")
        await websocket.close()
        return

    client: Mistral = Mistral(api_key=api_key)

    try:
        while True:
            data_str: str = await websocket.receive_text()

            try:
                data_dict: Dict[str, Any] = json.loads(data_str)
                req_item: CodeItem = CodeItem(**data_dict)
            except (json.JSONDecodeError, ValidationError) as e:
                error_msg: str = f"Invalid format: {e}"
                await websocket.send_text(error_msg)
                continue

            prompt_text: str = build_analysis_prompt(req_item)

            # Call the Codestral API
            response: Any = client.chat.complete(
                model="devstral-latest",
                messages=[
                    {
                        "role": "user",
                        "content": prompt_text
                    }
                ],
                temperature=0.2,
                max_tokens=300,
                response_format={"type": "json_object"}
            )

            raw_content: str = response.choices[0].message.content

            try:
                parsed_content: Dict[str, str] = json.loads(raw_content)
                result_text: str = parsed_content.get(
                    "advice",
                    raw_content
                )
            except json.JSONDecodeError:
                result_text = raw_content

            output_dict: Dict[str, Any] = {
                "text_coordination": req_item.text_coordination,
                "content": result_text
            }

            output_str: str = json.dumps(
                output_dict,
                ensure_ascii=False
            )

            await websocket.send_text(output_str)

    except WebSocketDisconnect:
        print("Client disconnected.")


def run_websocket_test() -> None:
    """
    Tests the WebSocket analysis endpoint with sample data.
    """
    from fastapi.testclient import TestClient

    client: TestClient = TestClient(app)

    # Sample code snippets to analyze
    snippets: List[Dict[str, str]] = [
        {
            "context": "Python file handling.",
            "content": "f = open('data.txt')\ndata = f.read()",
        },
        {
            "context": "C language memory allocation.",
            "content": "char *str = malloc(10);\nstrcpy(str, \"Hello\");",
        }
    ]

    sample_data: List[Dict[str, Any]] = [
        {
            "text_coordination": {
                "x": 100,
                "y": 150 + (i * 100)
            },
            "context": snippet["context"],
            "content": snippet["content"],
            "language": "Japanese"
        }
        for i, snippet in enumerate(snippets)
    ]

    try:
        with client.websocket_connect("/ws/advise") as ws:
            for data in sample_data:
                json_str: str = json.dumps(data)
                ws.send_text(json_str)

                response_str: str = ws.receive_text()

                print(f"Code: {data['content']}")
                print(f"Advice: {response_str}\n")

    except Exception as e:
        print(f"Test failed: {e}")


if __name__ == "__main__":
    run_websocket_test()