import asyncio
import json
import os
from typing import Any, Dict, List, Optional

from pydantic import BaseModel
from mistralai import Mistral


class CodeItem(BaseModel):
    """
    Input schema for the code analysis request.

    Attributes:
        text_coordination: The spatial coordinates (x, y).
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


async def get_code_advise(item: CodeItem) -> Dict[str, Any]:
    """
    Core logic to get code advice from Mistral Chat API.
    This function is designed to be called internally by other modules.

    Args:
        item (CodeItem): The request item containing code and context.

    Returns:
        Dict[str, Any]: A dictionary containing coordination and agent advice.
    """
    api_key: str = os.getenv("MISTRAL_API_KEY", "")

    if not api_key:
        return {"error": "MISTRAL_API_KEY is missing."}

    client: Mistral = Mistral(api_key=api_key)
    prompt_text: str = build_analysis_prompt(item)

    try:
        # Call the Codestral (devstral) API via Chat Completion
        response = client.chat.complete(
            model="codestral-latest", # model name updated for general usage
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

        return {
            "text_coordination": item.text_coordination,
            "content": result_text
        }

    except Exception as e:
        return {"error": f"API call failed: {str(e)}"}


def run_internal_test() -> None:
    """
    Directly tests the logic function without any network overhead.
    """
    # Sample code snippet to analyze
    item = CodeItem(
        text_coordination={"x": 100, "y": 200},
        context="C language memory allocation.",
        content="char *str = malloc(10);\nstrcpy(str, \"Hello\");",
        language="Japanese"
    )

    print("--- Starting internal code analysis test ---")
    # Execute the async function in a synchronous context for verification
    result = asyncio.run(get_code_advise(item))

    if "error" in result:
        print(f"Test Failed: {result['error']}")
    else:
        print(f"Code Content:\n{item.content}")
        print(f"Advice Result:\n{result['content']}")


if __name__ == "__main__":
    run_internal_test()