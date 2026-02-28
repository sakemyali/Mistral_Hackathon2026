import asyncio
import json
import time
import uuid
from typing import Literal, TypedDict

from langgraph.graph import END, StateGraph

from .config import CONFIDENCE_THRESHOLD, DEFAULT_AUDIO_MODEL, DEFAULT_CODE_MODEL, DEFAULT_TEXT_MODEL
from .mistral_client import complete_text


class WorkflowState(TypedDict, total=False):
    input_type: Literal["text", "code", "audio"]
    content: str
    target_language: str
    session_id: str
    trace_id: str

    intent: str
    confidence: float
    route: str

    model_name: str
    raw_model_output: str
    final_result: str

    started_at: float
    latency_ms: int


def _looks_foreign_language(text: str) -> bool:
    return any("\u3040" <= ch <= "\u30ff" or "\u4e00" <= ch <= "\u9faf" for ch in text)


def ingest_node(state: WorkflowState) -> WorkflowState:
    state["trace_id"] = state.get("trace_id") or str(uuid.uuid4())
    state["started_at"] = time.time()
    return state


def classify_intent_node(state: WorkflowState) -> WorkflowState:
    input_type = state["input_type"]
    content = state["content"]

    if input_type == "audio":
        state["intent"] = "voice_input"
        state["confidence"] = 0.95
    elif input_type == "code":
        if "error" in content.lower() or "exception" in content.lower():
            state["intent"] = "error_visible"
            state["confidence"] = 0.9
        else:
            state["intent"] = "hesitation_coding"
            state["confidence"] = 0.8
    else:
        if _looks_foreign_language(content):
            state["intent"] = "foreign_language"
            state["confidence"] = 0.85
        else:
            state["intent"] = "typing_fluent"
            state["confidence"] = 0.75

    return state


def route_node(state: WorkflowState) -> WorkflowState:
    confidence = state["confidence"]
    intent = state["intent"]

    if confidence < CONFIDENCE_THRESHOLD:
        state["route"] = "pass_through"
        return state

    if intent == "foreign_language":
        state["route"] = "translate"
        state["model_name"] = DEFAULT_TEXT_MODEL
    elif intent in {"hesitation_coding", "error_visible"}:
        state["route"] = "code"
        state["model_name"] = DEFAULT_CODE_MODEL
    elif intent == "voice_input":
        state["route"] = "voice"
        state["model_name"] = DEFAULT_AUDIO_MODEL
    else:
        state["route"] = "pass_through"
        state["model_name"] = DEFAULT_TEXT_MODEL

    return state


def _build_prompt(state: WorkflowState) -> str:
    route = state["route"]
    target_language = state.get("target_language", "ja")
    content = state["content"]

    if route == "translate":
        return f"Translate the text to {target_language}. Return only the translated result.\n\n{content}"
    if route == "code":
        return (
            "You are a coding support assistant. "
            "Explain the issue and propose a fix with short actionable steps.\n\n"
            f"{content}"
        )
    if route == "voice":
        return f"Transcribed voice input is below. Respond in {target_language} with a concise helpful answer.\n\n{content}"
    return f"Respond in {target_language}.\n\n{content}"


async def call_mistral_model_node(state: WorkflowState) -> WorkflowState:
    if state["route"] == "pass_through":
        state["raw_model_output"] = state["content"]
        return state

    prompt = _build_prompt(state)
    model_name = state.get("model_name", DEFAULT_TEXT_MODEL)
    state["raw_model_output"] = await asyncio.to_thread(complete_text, model_name, prompt)
    return state


def postprocess_node(state: WorkflowState) -> WorkflowState:
    state["final_result"] = state.get("raw_model_output", "").strip()
    return state


def moderate_node(state: WorkflowState) -> WorkflowState:
    return state


def return_response_node(state: WorkflowState) -> WorkflowState:
    return state


def log_trace_node(state: WorkflowState) -> WorkflowState:
    started_at = state.get("started_at", time.time())
    state["latency_ms"] = int((time.time() - started_at) * 1000)
    trace_payload = {
        "trace_id": state.get("trace_id"),
        "session_id": state.get("session_id"),
        "intent": state.get("intent"),
        "confidence": state.get("confidence"),
        "route": state.get("route"),
        "model_name": state.get("model_name"),
        "latency_ms": state.get("latency_ms"),
    }
    print(json.dumps(trace_payload, ensure_ascii=False))
    return state


def _next_after_route(state: WorkflowState) -> str:
    return "call_mistral_model"


def build_graph():
    graph = StateGraph(WorkflowState)

    graph.add_node("ingest", ingest_node)
    graph.add_node("classify_intent", classify_intent_node)
    graph.add_node("route", route_node)
    graph.add_node("call_mistral_model", call_mistral_model_node)
    graph.add_node("postprocess", postprocess_node)
    graph.add_node("moderate", moderate_node)
    graph.add_node("return_response", return_response_node)
    graph.add_node("log_trace", log_trace_node)

    graph.set_entry_point("ingest")
    graph.add_edge("ingest", "classify_intent")
    graph.add_edge("classify_intent", "route")
    graph.add_conditional_edges("route", _next_after_route)
    graph.add_edge("call_mistral_model", "postprocess")
    graph.add_edge("postprocess", "moderate")
    graph.add_edge("moderate", "return_response")
    graph.add_edge("return_response", "log_trace")
    graph.add_edge("log_trace", END)

    return graph.compile()


WORKFLOW = build_graph()


async def invoke_workflow(
    input_type: Literal["text", "code", "audio"],
    content: str,
    target_language: str,
    session_id: str,
) -> WorkflowState:
    initial_state: WorkflowState = {
        "input_type": input_type,
        "content": content,
        "target_language": target_language,
        "session_id": session_id,
    }
    return await WORKFLOW.ainvoke(initial_state)
