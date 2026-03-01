from .registry import AgentRegistry

# Initialize with no agents for hackathon MVP.
# To add agents later:
#   from agents import agent_registry
#   agent_registry.register(MyAgent())
agent_registry = AgentRegistry()
