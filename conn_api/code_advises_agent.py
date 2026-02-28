import json
import os
import asyncio
from typing import Any, Dict, List, Optional

from pydantic import BaseModel
from mistralai import Mistral


class CodeItem(BaseModel):
    """
    Input schema for the code analysis request.

    Attributes:
        text_coordination: The spatial coordinates (x, y).
        context: The surrounding context or situation.
        content: The actual code content to analyze.
        language: The target language for the output.
    """
    text_coordination: Dict[str, int]
    context: str
    content: str
    language: str


def build_messages(item: CodeItem) -> List[Dict[str, str]]:
    """
    Build the messages list for Mistral Agents API.

    Args:
        item (CodeItem): The input data containing code and context.

    Returns:
        List[Dict[str, str]]: Formatted messages for the agent.
    """
    prompt: str = (
        f"Context: {item.context}\n"
        f"Language: {item.language}\n"
        f"Code: {item.content}"
    )
    return [{"role": "user", "content": prompt}]


async def get_code_advice(item: CodeItem) -> Dict[str, Any]:
    """
    Core logic to get code advice from Mistral Agent.
    This function is designed to be called internally by other Python modules.

    Args:
        item (CodeItem): The request item containing code and context.

    Returns:
        Dict[str, Any]: A dictionary containing coordination and agent advice.
    """
    api_key: str = os.getenv("MISTRAL_API_KEY", "")
    agent_id: str = os.getenv("MISTRAL_CODE_AGENT_ID", "")

    if not api_key or not agent_id:
        return {"error": "API configuration missing."}

    try:
        # Initialize client inside the function for stateless execution
        client: Mistral = Mistral(api_key=api_key)
        messages = build_messages(item)

        # Execute completion using the Mistral Agent
        response = client.agents.complete(
            agent_id=agent_id,
            messages=messages
        )

        raw_content: str = response.choices[0].message.content

        return {
            "text_coordination": item.text_coordination,
            "content": raw_content
        }
    except Exception as e:
        return {"error": f"API call failed: {str(e)}"}


def run_internal_test() -> None:
    """
    Directly tests the logic function without any network overhead.
    """
    # Define sample data locally
    item = CodeItem(
        text_coordination={"x": 100, "y": 200},
        context="Python list comprehension.",
        content="res = []\nfor x in range(10): res.append(x * 2)",
        language="English"
    )

    print("--- Starting internal function test ---")
    # Execute the async function in a synchronous context for verification
    result = asyncio.run(get_code_advice(item))

    if "error" in result:
        print(f"Test Failed: {result['error']}")
    else:
        print(f"Advice result:\n{result['content']}")


if __name__ == "__main__":
    run_internal_test()