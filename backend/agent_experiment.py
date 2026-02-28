import argparse
import os

from mistralai import Mistral


def main() -> None:
    parser = argparse.ArgumentParser(description="Mistral Studio agent experiment")
    parser.add_argument("--agent-id", required=True, help="Mistral Studio agent id")
    parser.add_argument("--message", default="Hello!", help="User input message")
    args = parser.parse_args()

    api_key = os.environ.get("MISTRAL_API_KEY")
    if not api_key:
        raise RuntimeError("MISTRAL_API_KEY is not set")

    client = Mistral(api_key=api_key)
    inputs = [{"role": "user", "content": args.message}]

    response = client.beta.conversations.start(
        agent_id=args.agent_id,
        inputs=inputs,
    )
    print(response)


if __name__ == "__main__":
    main()
