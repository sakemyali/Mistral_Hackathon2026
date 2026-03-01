from abc import ABC, abstractmethod
from typing import Any, Optional

from pydantic import BaseModel


class AgentContext(BaseModel):
    intent: str
    confidence: float
    ocr_text: str
    vision_analysis: str
    timestamp: float
    voice_id: Optional[str] = None


class AgentResponse(BaseModel):
    agent_name: str
    action: Optional[str] = None
    data: Any = None


class BaseAgent(ABC):
    name: str = "base"

    @abstractmethod
    async def should_activate(self, context: AgentContext) -> bool:
        """Return True if this agent should handle the current context."""
        ...

    @abstractmethod
    async def execute(self, context: AgentContext) -> AgentResponse:
        """Execute the agent's logic and return a response."""
        ...
