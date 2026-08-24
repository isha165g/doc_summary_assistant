import logging
from typing import Literal
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

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
    summary="Upload a document and receive a stubbed summary response",
)
async def summarize_document(
    file: UploadFile = File(...),
    length: str = Form(default="medium"),
):
    """
    Phase 2 File Upload Pipeline Endpoint:
    - Validates file presence and non-empty content (400)
    - Validates MIME type (PDF, PNG, JPEG) (415)
    - Validates file size <= 10MB (413)
    - Logs MIME branch
    - Returns structured stubbed summary JSON
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
        print(f"[Summarize Pipeline] Received PDF document: '{file.filename}' ({file_size} bytes)")
        logger.info("MIME Branch -> PDF processing pipeline for %s", file.filename)
    else:
        print(f"[Summarize Pipeline] Received Image document: '{file.filename}' ({file_size} bytes)")
        logger.info("MIME Branch -> Image OCR processing pipeline for %s", file.filename)

    # 5. Normalize requested length
    normalized_length: Literal["short", "medium", "long"] = "medium"
    if length.lower() in ["short", "medium", "long"]:
        normalized_length = length.lower()  # type: ignore

    # 6. Return STUBBED summary contract
    return SummaryResponse(
        filename=file.filename,
        file_type=detected_type,
        length=normalized_length,
        summary=(
            "This is a placeholder summary. Real extraction and "
            "summarization will be added in later phases."
        ),
        key_points=[
            "Placeholder key point 1",
            "Placeholder key point 2",
            "Placeholder key point 3",
        ],
        word_count=0,
    )
