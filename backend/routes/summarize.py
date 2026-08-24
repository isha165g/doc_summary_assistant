import logging
from typing import Literal
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from services.extraction import ExtractionError, NoTextFoundError, extract_text
from services.summarization import SummarizationError, summarize_text

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


class SummaryResponse(BaseModel):
    filename: str
    file_type: Literal["pdf", "image"]
    length: Literal["short", "medium", "long"]
    summary: str
    key_points: list[str]
    word_count: int


@router.post(
    "/api/summarize",
    response_model=SummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload a document and receive extracted text & preview summary",
)
async def summarize_document(
    file: UploadFile = File(...),
    length: str = Form(default="medium"),
):
    """
    Phase 3 Document Summarization Endpoint:
    - Validates file presence, size (<=10MB), and MIME type
    - Extracts raw text using pdfplumber (PDF) or Tesseract OCR (Image)
    - Returns 422 Unprocessable Entity if no text is found
    - Returns 500 Internal Server Error if extraction fails unexpectedly
    - Returns first 300 characters of real extracted text and word count
    """
    # 1. Validate file presence & filename
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file was uploaded or file name is missing.",
        )

    # 2. Validate MIME type
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

    # 3. Read content and validate size / emptiness
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

    # 4. MIME-type branching and logging
    if detected_type == "pdf":
        print(f"[Extraction Pipeline] Processing PDF document: '{file.filename}' ({file_size} bytes)")
        logger.info("Extracting text from PDF: %s", file.filename)
    else:
        print(f"[Extraction Pipeline] Processing Image document with OCR: '{file.filename}' ({file_size} bytes)")
        logger.info("Extracting text from Image with OCR: %s", file.filename)

    # 5. Extract real text using extraction service
    try:
        extracted_text = extract_text(content, detected_type)
    except NoTextFoundError as no_text_err:
        print(f"[Extraction Warning] No text found in '{file.filename}': {no_text_err}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No readable text found in this document. Please try a clearer scan or a different file.",
        )
    except ExtractionError as ext_err:
        print(f"[Extraction Error] Failed parsing '{file.filename}': {ext_err}")
        logger.error("Extraction error for %s: %s", file.filename, ext_err, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process document.",
        )
    except Exception as exc:
        print(f"[Extraction Error] Unexpected server error for '{file.filename}': {exc}")
        logger.error("Unexpected error for %s: %s", file.filename, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process document.",
        )

    # 6. Normalize requested length
    normalized_length: Literal["short", "medium", "long"] = "medium"
    if length.lower() in ["short", "medium", "long"]:
        normalized_length = length.lower()  # type: ignore

    # 7. Word count from the ORIGINAL extracted text
    words = extracted_text.split()
    word_count = len(words)

    # 8. Real LLM Summarization using Groq (Phase 4)
    try:
        print(f"[Summarization Pipeline] Generating {normalized_length} summary for '{file.filename}'...")
        summary_result = summarize_text(extracted_text, normalized_length)
    except SummarizationError as sum_err:
        print(f"[Summarization Error] LLM generation failed for '{file.filename}': {sum_err}")
        logger.error("Summarization error for %s: %s", file.filename, sum_err, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Summary generation failed, please try again",
        )
    except Exception as exc:
        print(f"[Summarization Error] Unexpected error during AI summary for '{file.filename}': {exc}")
        logger.error("Unexpected summarization error for %s: %s", file.filename, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Summary generation failed, please try again",
        )

    return SummaryResponse(
        filename=file.filename,
        file_type=detected_type,
        length=normalized_length,
        summary=summary_result.get("summary", "").strip(),
        key_points=summary_result.get("key_points", []),
        word_count=word_count,
    )
