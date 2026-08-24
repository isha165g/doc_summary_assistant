import asyncio
import hashlib
import json
import logging
import time
from collections import defaultdict
from typing import Any, AsyncGenerator, Dict, Literal, Optional
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.extraction import ExtractionError, NoTextFoundError, extract_text
from services.summarization import SummarizationError, classify_document_type, summarize_text

logger = logging.getLogger("summarize_route")

router = APIRouter(tags=["summarize"])

# Maximum allowable file size in bytes (10 MB)
MAX_FILE_SIZE = 10 * 1024 * 1024

# Supported content types and extension mappings
SUPPORTED_MIME_TYPES = {
    "application/pdf": "pdf",
    "image/jpeg": "image",
    "image/png": "image",
    "image/jpg": "image",
}

# =====================================================================
# 4. IN-MEMORY CACHING FOR DUPLICATE UPLOADS
# =====================================================================
# Keyed by sha256(file_bytes) + ":" + length
# Process-local cache that avoids duplicate OCR & LLM quota usage.
_DOCUMENT_CACHE: Dict[str, Dict[str, Any]] = {}
MAX_CACHE_ENTRIES = 200


def _get_cache_key(file_bytes: bytes, length: str) -> str:
    sha = hashlib.sha256(file_bytes).hexdigest()
    return f"{sha}:{length.lower()}"


def _get_cached_result(cache_key: str) -> Optional[Dict[str, Any]]:
    return _DOCUMENT_CACHE.get(cache_key)


def _store_cache_result(cache_key: str, data: Dict[str, Any]) -> None:
    if len(_DOCUMENT_CACHE) >= MAX_CACHE_ENTRIES:
        # Evict oldest entry
        oldest_key = next(iter(_DOCUMENT_CACHE))
        _DOCUMENT_CACHE.pop(oldest_key, None)
    _DOCUMENT_CACHE[cache_key] = data


# =====================================================================
# 5. BASIC RATE LIMITING (In-Memory Sliding Window)
# =====================================================================
# 10 requests per 60 seconds per client IP
RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_REQUESTS = 10
_RATE_LIMIT_STORE: Dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()

    # Clean timestamps older than window
    timestamps = [t for t in _RATE_LIMIT_STORE[client_ip] if now - t < RATE_LIMIT_WINDOW_SECONDS]
    _RATE_LIMIT_STORE[client_ip] = timestamps

    if len(timestamps) >= RATE_LIMIT_MAX_REQUESTS:
        logger.warning("Rate limit exceeded for IP %s (%d requests in 60s)", client_ip, len(timestamps))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded (10 requests per minute). Please wait a moment before trying again.",
        )

    _RATE_LIMIT_STORE[client_ip].append(now)


# =====================================================================
# RESPONSE MODELS
# =====================================================================

class SummaryResponse(BaseModel):
    filename: str
    file_type: Literal["pdf", "image"]
    length: Literal["short", "medium", "long"]
    summary: str
    key_points: list[str]
    word_count: int
    document_type: Optional[str] = "general/other"
    cached: Optional[bool] = False


# =====================================================================
# VALIDATION HELPER
# =====================================================================

async def _validate_and_read_upload(file: UploadFile) -> tuple[bytes, Literal["pdf", "image"]]:
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file was uploaded or file name is missing.",
        )

    content_type = (file.content_type or "").lower()
    filename_lower = file.filename.lower()

    detected_type: Literal["pdf", "image"] | None = None
    if content_type in SUPPORTED_MIME_TYPES:
        detected_type = SUPPORTED_MIME_TYPES[content_type]
    elif filename_lower.endswith(".pdf"):
        detected_type = "pdf"
    elif filename_lower.endswith((".jpg", ".jpeg", ".png")):
        detected_type = "image"

    if not detected_type:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported file type '{file.content_type or 'unknown'}'. "
                "Only application/pdf, image/jpeg, and image/png are supported."
            ),
        )

    content = await file.read()
    file_size = len(content)

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty (0 bytes). Please upload a valid document.",
        )

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size ({file_size / (1024 * 1024):.2f} MB) exceeds maximum allowed size of 10 MB.",
        )

    return content, detected_type


# =====================================================================
# STANDARD SYNC ENDPOINT (/api/summarize)
# =====================================================================

@router.post(
    "/api/summarize",
    response_model=SummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload a document and receive extracted text & structured AI summary",
)
async def summarize_document(
    request: Request,
    file: UploadFile = File(...),
    length: str = Form(default="medium"),
):
    """
    Standard Document Summarization Endpoint:
    - Rate-limits to 10 requests / min per IP
    - Checks in-memory cache for duplicate file contents
    - Extracts raw text using pdfplumber/OCR with OpenCV preprocessing
    - Classifies document type and tailors Groq LLaMA 3.3 summarization prompt
    - Returns structured summary, key points, word count, and document type
    """
    _check_rate_limit(request)

    content, detected_type = await _validate_and_read_upload(file)

    normalized_length: Literal["short", "medium", "long"] = "medium"
    if length.lower() in ["short", "medium", "long"]:
        normalized_length = length.lower()  # type: ignore

    # Check Cache
    cache_key = _get_cache_key(content, normalized_length)
    cached_entry = _get_cached_result(cache_key)
    if cached_entry:
        logger.info("Serving cached summary for '%s' (hash=%s)", file.filename, cache_key[:12])
        return SummaryResponse(
            filename=file.filename or cached_entry["filename"],
            file_type=detected_type,
            length=normalized_length,
            summary=cached_entry["summary"],
            key_points=cached_entry["key_points"],
            word_count=cached_entry["word_count"],
            document_type=cached_entry.get("document_type", "general/other"),
            cached=True,
        )

    # Extraction
    try:
        extracted_text = extract_text(content, detected_type)
    except NoTextFoundError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No readable text found in this document. Please try a clearer scan or a different file.",
        )
    except ExtractionError as ext_err:
        logger.error("Extraction error for %s: %s", file.filename, ext_err, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process document.",
        )

    words = extracted_text.split()
    word_count = len(words)

    # Document Classification & Summarization
    doc_type = classify_document_type(extracted_text)

    try:
        summary_result = summarize_text(extracted_text, normalized_length, explicit_doc_type=doc_type)
    except SummarizationError as sum_err:
        logger.error("Summarization error for %s: %s", file.filename, sum_err, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Summary generation failed, please try again",
        )

    final_summary = summary_result.get("summary", "").strip()
    final_key_points = summary_result.get("key_points", [])
    final_doc_type = summary_result.get("document_type", doc_type)

    # Store in memory cache
    _store_cache_result(
        cache_key,
        {
            "filename": file.filename,
            "file_type": detected_type,
            "summary": final_summary,
            "key_points": final_key_points,
            "word_count": word_count,
            "document_type": final_doc_type,
        },
    )

    return SummaryResponse(
        filename=file.filename,
        file_type=detected_type,
        length=normalized_length,
        summary=final_summary,
        key_points=final_key_points,
        word_count=word_count,
        document_type=final_doc_type,
        cached=False,
    )


# =====================================================================
# 1. STREAMING PROGRESS FEEDBACK (Server-Sent Events / SSE)
# =====================================================================

@router.post(
    "/api/summarize-stream",
    summary="Upload a document and receive real-time streaming progress updates and final summary via SSE",
)
async def summarize_document_stream(
    request: Request,
    file: UploadFile = File(...),
    length: str = Form(default="medium"),
):
    """
    Streaming Document Summarization Endpoint (Server-Sent Events):
    Streams live stages:
    1. 'validating' -> 'extracting'
    2. 'extracted' with real word count
    3. 'classifying' with detected document archetype
    4. 'summarizing' via Groq LLaMA 3.3
    5. 'complete' with final SummaryResponse payload or 'error'
    """
    _check_rate_limit(request)

    content, detected_type = await _validate_and_read_upload(file)

    normalized_length: Literal["short", "medium", "long"] = "medium"
    if length.lower() in ["short", "medium", "long"]:
        normalized_length = length.lower()  # type: ignore

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            # Stage 1: Validation & Cache Check
            yield f"data: {json.dumps({'stage': 'validating', 'message': f'Received {file.filename}. Validating payload...'})}\n\n"
            await asyncio.sleep(0.1)

            cache_key = _get_cache_key(content, normalized_length)
            cached_entry = _get_cached_result(cache_key)
            if cached_entry:
                yield f"data: {json.dumps({'stage': 'cached', 'message': 'Identical document found in server cache. Returning instant result...'})}\n\n"
                await asyncio.sleep(0.2)
                response_payload = {
                    "filename": file.filename,
                    "file_type": detected_type,
                    "length": normalized_length,
                    "summary": cached_entry["summary"],
                    "key_points": cached_entry["key_points"],
                    "word_count": cached_entry["word_count"],
                    "document_type": cached_entry.get("document_type", "general/other"),
                    "cached": True,
                }
                yield f"data: {json.dumps({'stage': 'complete', 'result': response_payload})}\n\n"
                return

            # Stage 2: Extraction
            yield f"data: {json.dumps({'stage': 'extracting', 'message': 'Reading document layout & running OCR preprocessing...' if detected_type == 'image' else 'Parsing PDF layout & extracting text...'})}\n\n"
            await asyncio.sleep(0.1)

            try:
                # Run synchronous extraction in threadpool
                logger.info(
                    "STARTING EXTRACTION: file=%s type=%s size=%d bytes",
                    file.filename,
                    detected_type,
                    len(content),
                )

                extraction_task = asyncio.create_task(
                    asyncio.to_thread(extract_text, content, detected_type)
                )

                try:
                    extracted_text = await asyncio.wait_for(
                        extraction_task,
                        timeout=60
                    )
                except asyncio.TimeoutError:
                    logger.error(
                        "PDF extraction timed out after 60 seconds for %s",
                        file.filename
                    )

                    error_data = {
                        "stage": "error",
                        "status": 504,
                        "message": "PDF extraction took too long. Please try a smaller or simpler PDF."
                    }

                    yield f"data: {json.dumps(error_data)}\n\n"
                    return

                logger.info(
                    "EXTRACTION FINISHED: file=%s words=%d",
                    file.filename,
                    len(extracted_text.split()),
                )
            except NoTextFoundError:
                yield f"data: {json.dumps({'stage': 'error', 'status': 422, 'message': 'No readable text found in this document. Please ensure the document is clear.'})}\n\n"
                return
            except Exception as ext_err:
                logger.error("Streaming extraction error: %s", ext_err)
                yield f"data: {json.dumps({'stage': 'error', 'status': 500, 'message': 'Failed to extract text from document.'})}\n\n"
                return

            words = extracted_text.split()
            word_count = len(words)

            # Stage 3: Extracted
            yield f"data: {json.dumps({'stage': 'extracted', 'word_count': word_count, 'message': f'Extracted {word_count:,} words from {file.filename}'})}\n\n"
            await asyncio.sleep(0.15)

            # Stage 4: Classification
            doc_type = classify_document_type(extracted_text)
            doc_type_label = doc_type.replace("/", " ").title()
            yield f"data: {json.dumps({'stage': 'classifying', 'document_type': doc_type, 'message': f'Classified as {doc_type_label}. Tailoring summarization prompt...'})}\n\n"
            await asyncio.sleep(0.15)

            # Stage 5: Summarization
            yield f"data: {json.dumps({'stage': 'summarizing', 'message': 'Generating structured summary and key takeaways via LLaMA 3.3...'})}\n\n"

            try:
                summary_result = await asyncio.to_thread(
                    summarize_text, extracted_text, normalized_length, doc_type
                )
            except Exception as sum_err:
                logger.error("Streaming summarization error: %s", sum_err)
                yield f"data: {json.dumps({'stage': 'error', 'status': 502, 'message': 'Could not generate summary right now. Please try again.'})}\n\n"
                return

            final_summary = summary_result.get("summary", "").strip()
            final_key_points = summary_result.get("key_points", [])
            final_doc_type = summary_result.get("document_type", doc_type)

            # Cache
            _store_cache_result(
                cache_key,
                {
                    "filename": file.filename,
                    "file_type": detected_type,
                    "summary": final_summary,
                    "key_points": final_key_points,
                    "word_count": word_count,
                    "document_type": final_doc_type,
                },
            )

            # Final Complete Event
            response_payload = {
                "filename": file.filename,
                "file_type": detected_type,
                "length": normalized_length,
                "summary": final_summary,
                "key_points": final_key_points,
                "word_count": word_count,
                "document_type": final_doc_type,
                "cached": False,
            }

            yield f"data: {json.dumps({'stage': 'complete', 'result': response_payload})}\n\n"

        except Exception as general_err:
            logger.error("Unexpected stream failure: %s", general_err)
            yield f"data: {json.dumps({'stage': 'error', 'status': 500, 'message': str(general_err)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
