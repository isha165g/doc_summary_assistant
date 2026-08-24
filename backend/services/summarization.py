"""
Summarization service for Document Summary Assistant (Phase 4).
Uses Groq API (with dynamic model discovery and failover)
to produce structured summaries and key takeaways from extracted document text.
"""

import json
import logging
import os
import re
import time
from typing import Any, Dict, List
from dotenv import load_dotenv
from groq import Groq, APIConnectionError, APIStatusError, RateLimitError

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger("summarization_service")

# Candidate Groq models to try in order
DEFAULT_GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama-3.2-11b-vision-preview",
    "llama-3.2-3b-preview",
    "llama-3.2-1b-preview",
    "qwen-2.5-32b",
    "deepseek-r1-distill-llama-70b",
]

MAX_INPUT_CHAR_LIMIT = 12000

# Mapping of length presets to exact sentence guidelines
LENGTH_INSTRUCTIONS = {
    "short": "Provide a concise summary in exactly 2 to 3 sentences.",
    "medium": "Provide a balanced, thorough summary in exactly 5 to 6 sentences.",
    "long": "Provide a comprehensive, detailed summary in exactly 8 to 10 sentences.",
}


class SummarizationError(Exception):
    """Raised when document summarization fails due to API errors, missing keys, or malformed responses."""
    pass


def _get_groq_client() -> Groq:
    """
    Retrieves a Groq client instance after validating that the API key exists.
    Raises SummarizationError with instructions if the key is missing.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or not api_key.strip() or api_key.strip() == "your_groq_api_key_here":
        raise SummarizationError(
            "GROQ_API_KEY environment variable is missing or unset. "
            "Please configure your Groq API key in your .env file or environment."
        )
    return Groq(api_key=api_key.strip())


def _clean_and_parse_json(raw_text: str) -> Dict[str, Any]:
    """
    Strips accidental markdown code fences (```json ... ```) or preambles and parses JSON.
    """
    text = raw_text.strip()
    
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()

    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        text = match.group(0)

    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("Root JSON is not an object.")

    if "summary" not in data or "key_points" not in data:
        raise ValueError("Missing 'summary' or 'key_points' in parsed JSON response.")

    if not isinstance(data["key_points"], list):
        raise ValueError("'key_points' must be a list of strings.")

    data["key_points"] = [str(pt).strip() for pt in data["key_points"] if str(pt).strip()]
    data["summary"] = str(data["summary"]).strip()

    return data


def _generate_extractive_fallback(text: str, length: str) -> Dict[str, Any]:
    """
    Fallback extractive summary if external AI models are experiencing downtime or rate limits.
    """
    sentences = [
        s.strip()
        for s in re.split(r"(?<=[.?!])\s+", text.replace("\n", " "))
        if len(s.strip()) > 20
    ]
    target_count = {"short": 3, "medium": 5, "long": 8}.get(length, 5)
    chosen = sentences[:target_count]
    summary = " ".join(chosen) if chosen else text[:300].strip() + "..."
    
    key_points = []
    for s in sentences[:4]:
        key_points.append(s[:137] + "..." if len(s) > 140 else s)
        
    if not key_points:
        key_points = [
            f"Extracted content ({len(text.split())} words).",
            "Key details processed from document text.",
        ]
        
    return {"summary": summary, "key_points": key_points}


def summarize_text(text: str, length: str = "medium") -> Dict[str, Any]:
    """
    Summarizes extracted document text using Groq with dynamic model discovery and failover.

    Args:
        text: Raw extracted document text.
        length: Desired summary length ('short', 'medium', or 'long').

    Returns:
        Dict containing:
            - summary: str
            - key_points: list[str] (3-5 bullet points)

    Raises:
        SummarizationError: If text is empty.
    """
    if not text or not text.strip():
        raise SummarizationError("Cannot summarize empty or whitespace-only text.")

    normalized_length = length.lower().strip() if length else "medium"
    if normalized_length not in LENGTH_INSTRUCTIONS:
        normalized_length = "medium"

    length_guideline = LENGTH_INSTRUCTIONS[normalized_length]

    # Handle text exceeding context threshold (~12,000 characters)
    is_truncated = False
    processed_text = text.strip()
    if len(processed_text) > MAX_INPUT_CHAR_LIMIT:
        processed_text = processed_text[:MAX_INPUT_CHAR_LIMIT]
        is_truncated = True

    truncation_note = (
        "\n\n[Note: The document text was truncated to fit character limits; "
        "summarize the provided excerpt accurately.]"
        if is_truncated
        else ""
    )

    system_prompt = (
        "You are an expert document summarization assistant. "
        "Your task is to analyze the provided document text and output an objective, accurate summary "
        "and 3 to 5 key takeaway points.\n\n"
        "Rules:\n"
        f"1. {length_guideline}\n"
        "2. Generate between 3 and 5 distinct, concise key takeaway points in the 'key_points' array.\n"
        "3. Output ONLY valid JSON in the exact schema below, with no markdown code blocks, backticks, or extra commentary.\n\n"
        "Required JSON schema:\n"
        "{\n"
        '  "summary": "string containing summary text",\n'
        '  "key_points": ["takeaway 1", "takeaway 2", "takeaway 3"]\n'
        "}"
    )

    user_prompt = f"Document Text:\n\"\"\"\n{processed_text}\n\"\"\"{truncation_note}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
        client = _get_groq_client()
        candidate_models = list(DEFAULT_GROQ_MODELS)
        
        try:
            model_list = client.models.list()
            if model_list and hasattr(model_list, "data") and model_list.data:
                active_ids = [
                    m.id for m in model_list.data 
                    if not any(x in m.id for x in ["whisper", "embed", "tts", "guard"])
                ]
                if active_ids:
                    candidate_models = active_ids
        except Exception as list_err:
            logger.warning("Groq dynamic models.list query failed: %s", list_err)

        for model_name in candidate_models:
            logger.info("Attempting summarization with Groq model: %s", model_name)
            for attempt in range(2):
                try:
                    response = client.chat.completions.create(
                        model=model_name,
                        messages=messages,
                        temperature=0.2,
                        response_format={"type": "json_object"},
                        max_tokens=1024,
                    )
                    raw_content = response.choices[0].message.content
                    if not raw_content:
                        continue
                    parsed = _clean_and_parse_json(raw_content)
                    if parsed.get("summary") and parsed.get("key_points"):
                        return parsed
                except (APIConnectionError, RateLimitError, APIStatusError) as api_err:
                    logger.warning("Groq model %s attempt %d failed: %s", model_name, attempt + 1, api_err)
                    if attempt == 0:
                        time.sleep(1.0)
                        continue
                    break
                except Exception as e:
                    logger.warning("Parsing or execution error with Groq model %s: %s", model_name, e)
                    break
    except SummarizationError:
        logger.info("GROQ_API_KEY not configured or invalid. Using fallback summary generator.")
    except Exception as general_err:
        logger.warning("Groq summarization encountered error: %s", general_err)

    # Return reliable extractive fallback if all external models are unreachable
    logger.info("Generating fallback extractive summary.")
    return _generate_extractive_fallback(text, normalized_length)
