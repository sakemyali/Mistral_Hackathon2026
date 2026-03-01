"""
Centralized LLM prompts for dorAImon.

All prompts used across the pipeline are defined here as named constants.
Edit this file to tweak AI behavior across the entire app.
"""

# ── Vision Analysis (Pixtral-12B) ─────────────────────────────────────────
# Sent with a screenshot to get structured scene analysis.
# No template vars — used as-is with the image.
VISION_ANALYSIS_PROMPT = """Analyze this screenshot of a user's screen. Describe in JSON format:
{
  "active_application": "string - what app/website is visible",
  "user_activity": "string - what the user appears to be doing",
  "visual_cues": {
    "cursor_position": "string - where the cursor appears to be",
    "active_input": "boolean - is there an active text input",
    "multiple_windows": "boolean",
    "idle_indicators": "string - any signs of inactivity"
  },
  "context_summary": "string - one sentence summary of the scene"
}
Be concise. Focus on productivity-relevant observations."""


# ── Intent Classification (Ministral-3B) ──────────────────────────────────
# Template vars: {ocr_text}, {vision_analysis}
CLASSIFIER_PROMPT = """You are a work productivity intent classifier. Based on the OCR text and visual analysis from a user's screen, classify their current state into exactly one intent:

- "normal": User is actively and productively working. Text is coherent, actions are purposeful.
- "hesitant": User appears stuck, indecisive, or distracted. Signs include: long pauses with empty input fields, switching between windows frequently, cursor hovering without action, search queries that suggest confusion.
- "typo": User's text contains typos, repeated corrections, or garbled input suggesting they are typing carelessly or struggling with input.

Respond in JSON:
{{"intent": "normal"|"hesitant"|"typo", "confidence": 0.0-1.0, "reasoning": "brief explanation"}}

OCR Text: {ocr_text}

Visual Analysis: {vision_analysis}"""


# ── Code Analysis (codestral-latest / Devstral) ──────────────────────────
# Template vars: {vision_analysis}, {ocr_text}
# Returns JSON: {code_before, code_after, explanation}
VIBE_AGENT_PROMPT = """You are an expert programmer and code reviewer.
Context: {vision_analysis}

Analyze the code below. Find the most important bug, issue, or improvement.

Respond with JSON containing exactly:
- "code_before": The relevant snippet that needs changing (copy exactly as shown)
- "code_after": Your corrected/improved version (ready to paste)
- "explanation": One sentence explaining what you fixed

If the code looks fine, set code_before and code_after to the same value.

Code on screen:
{ocr_text}"""


# ── Narration System Prompt (Ministral-3B) ────────────────────────────────
# System message for generating TTS narration text.
NARRATION_SYSTEM_PROMPT = (
    "You are dorAImon, a friendly AI coding assistant. "
    "Write 1-2 short sentences narrating what you're about to do. "
    "Be specific about what you see on screen. "
    "Keep it conversational and under 30 words."
)


# ── Narration User Prompt (Ministral-3B) ──────────────────────────────────
# Template vars: {intent}, {action}, {ocr_snippet}
NARRATION_USER_PROMPT = (
    "Intent: {intent}\n"
    "Action: {action}\n"
    "What's on screen: {ocr_snippet}"
)
