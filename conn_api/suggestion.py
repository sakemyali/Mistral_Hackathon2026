import json
import os
from typing import Any, Dict, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ValidationError
from mistralai import Mistral


app: FastAPI = FastAPI()


class SuggestionItem(BaseModel):
    """
    Input schema for the suggestion and information request.

    Attributes:
        text_coordination: The spatial coordinates of the text.
        context: The surrounding context or situation.
        content: The actual text content to analyze.
        language: The target language for the output.
    """
    text_coordination: Dict[str, int]
    context: str
    content: str
    language: str


def build_suggestion_prompt(item: SuggestionItem) -> str:
    """
    Builds the prompt string for the LLM to provide suggestions.

    Args:
        item: The input item containing content and context.

    Returns:
        A formatted string instructing the LLM.
    """
    prompt: str = (
        "You are a helpful assistant.\n"
        f"Context: {item.context}\n"
        f"Content: {item.content}\n"
        f"Please analyze the context and content, and provide useful "
        f"information or suggestions in {item.language}.\n"
        "CRITICAL INSTRUCTION: You must respond ONLY with a valid "
        "JSON object.\n"
        'The JSON must have a single key named "suggestion" '
        'containing your text. Do not add any other text.\n'
    )
    return prompt


@app.websocket("/ws/suggest")
async def websocket_suggest(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for real-time information and suggestions.

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
            # Wait for text data from the client
            data_str: str = await websocket.receive_text()

            try:
                data_dict: Dict[str, Any] = json.loads(data_str)
                req_item: SuggestionItem = SuggestionItem(**data_dict)
            except (json.JSONDecodeError, ValidationError) as e:
                error_msg: str = f"Invalid format: {e}"
                await websocket.send_text(error_msg)
                continue

            prompt_text: str = build_suggestion_prompt(req_item)

            # Call the Mistral Small API
            response: Any = client.chat.complete(
                model="mistral-small-latest",
                messages=[
                    {
                        "role": "user",
                        "content": prompt_text
                    }
                ],
                temperature=0.3,
                max_tokens=300,
                response_format={"type": "json_object"}
            )

            raw_content: str = response.choices[0].message.content

            try:
                parsed_content: Dict[str, str] = json.loads(raw_content)
                result_text: str = parsed_content.get(
                    "suggestion",
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

            # Send the result back to the client
            await websocket.send_text(output_str)

    except WebSocketDisconnect:
        print("Client disconnected.")


def run_websocket_test() -> None:
    """
    Tests the WebSocket suggestion endpoint with sample data.
    """
    from fastapi.testclient import TestClient

    client: TestClient = TestClient(app)

    snippets: List[Dict[str, str]] = [
        {
            "context": "User is looking at a restaurant menu.",
            "content": "Spicy Thai Basil Chicken",
        },
        {
            "context": "User is reading a cloud architecture diagram.",
            "content": "Amazon S3 Bucket",
        }
    ]

    # Generate sample payloads
    sample_data: List[Dict[str, Any]] = [
        {
            "text_coordination": {
                "x": 200,
                "y": 300 + (i * 100)
            },
            "context": snippet["context"],
            "content": snippet["content"],
            "language": "Japanese"
        }
        for i, snippet in enumerate(snippets)
    ]

    try:
        with client.websocket_connect("/ws/suggest") as ws:
            for data in sample_data:
                json_str: str = json.dumps(data)
                ws.send_text(json_str)

                response_str: str = ws.receive_text()

                print(f"Content: {data['content']}")
                print(f"Suggestion: {response_str}\n")

    except Exception as e:
        print(f"Test failed: {e}")


if __name__ == "__main__":
    run_websocket_test()