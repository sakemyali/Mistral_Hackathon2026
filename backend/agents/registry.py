from typing import List, Optional

from .base import BaseAgent, AgentContext, AgentResponse


class AgentRegistry:
    def __init__(self):
        self._agents: List[BaseAgent] = []

    def register(self, agent: BaseAgent):
        """Register an agent. Agents are checked in registration order."""
        self._agents.append(agent)

    async def route(self, context: AgentContext) -> Optional[AgentResponse]:
        """Try each registered agent. First one that activates wins."""
        for agent in self._agents:
            if await agent.should_activate(context):
                return await agent.execute(context)
        return None
