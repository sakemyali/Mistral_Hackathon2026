import json
import os
from typing import Any, Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ValidationError
from mistralai import Mistral


app: FastAPI = FastAPI()


class TextItem(BaseModel):
    """
    Input schema for the translation request.

    Attributes:
        text_coordination: The spatial coordinates of the text.
        context: The surrounding context to aid translation.
        content: The actual text to translate.
        language: The target language.
    """
    text_coordination: Dict[str, int]
    context: str
    content: str  # the text to translate; may be a single word, phrase, or multiple sentences
    language: str


def build_prompt(item: TextItem) -> str:
    """
    Builds the prompt string for the LLM.
    """
    prompt: str = (
        f"Context: {item.context}\n"
        f"Translate the following text into {item.language}.\n"
        'CRITICAL INSTRUCTION: You must respond ONLY with a valid JSON object. '
        'The JSON must have a single key named "translation" containing the translated string. '
        'Do not add any other text.\n'
        f"Text: {item.content}"
    )
    return prompt


@app.websocket("/ws/translate")
async def websocket_translate(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for real-time translation.

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
                req_item: TextItem = TextItem(**data_dict)
            except (json.JSONDecodeError, ValidationError) as e:
                error_msg: str = f"Invalid format: {e}"
                await websocket.send_text(error_msg)
                continue

            prompt_text: str = build_prompt(req_item)

            # Call the Mistral API
            response: Any = client.chat.complete(
                model="mistral-medium-latest",
                messages=[
                    {
                        "role": "user",
                        "content": prompt_text
                    }
                ],
                temperature=0.0,
                max_tokens=150,
                response_format={"type": "json_object"}
            )

            raw_content: str = response.choices[0].message.content
            try:
                parsed_content: Dict[str, str] = json.loads(raw_content)
                result_text: str = parsed_content.get("translation", raw_content)
            except json.JSONDecodeError:
                result_text = raw_content

            output_dict: Dict[str, Any] = {
                "text_coordination": req_item.text_coordination,
                "content": result_text
            }

            output_str: str = json.dumps(output_dict)

            # Send the translated result back to the client
            await websocket.send_text(output_str)

    except WebSocketDisconnect:
        print("Client disconnected.")

def run_websocket_test() -> None:
    """
    Tests the WebSocket translation endpoint with sample data.

    This function initializes a FastAPI TestClient, connects to the
    WebSocket route, sends sample JSON payloads, and prints the results.
    """
    import json
    from typing import Any, Dict, List
    from fastapi.testclient import TestClient

    # Initialize the test client with the FastAPI app
    client: TestClient = TestClient(app)

    # single words for menu items
    words: List[str] = ["File", "Edit", "View"]

    # also include a multi-sentence example to demonstrate paragraph translation
    multi_sentence = (
        "This is the first sentence. "
        "Here is a second sentence, and finally a third."
        " This paragraph should be translated as a whole, preserving the meaning and flow to test the capacity of the translation system."
    )

    # Generate sample payloads using list comprehension
    sample_data: List[Dict[str, Any]] = [
        {
            "text_coordination": {
                "x": 50,
                "y": 100 + (i * 50)
            },
            "context": "Menu item in an editor.",
            "content": word,
            "language": "Japanese"
        }
        for i, word in enumerate(words)
    ]

    # add paragraph example at the end
    sample_data.append({
        "text_coordination": {"x": 50, "y": 300},
        "context": "A short paragraph to translate.",
        "content": multi_sentence,
        "language": "Japanese",
    })

    try:
        with client.websocket_connect("/ws/translate") as ws:
            for data in sample_data:
                json_str: str = json.dumps(data)
                ws.send_text(json_str)

                response_str: str = ws.receive_text()

                print(f"Request: {data['content']}")
                print(f"Response: {response_str}\n")

    except Exception as e:
        # Print the error message if the test fails
        print(f"Test failed: {e}")


if __name__ == "__main__":
    run_websocket_test()