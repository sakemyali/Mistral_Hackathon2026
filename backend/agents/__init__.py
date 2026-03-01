from .registry import AgentRegistry
from .vibe_agent import VibeAgent

agent_registry = AgentRegistry()
agent_registry.register(VibeAgent())
