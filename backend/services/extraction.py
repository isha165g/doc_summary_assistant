"""
Extraction service for Document Summary Assistant (Phase 3).
Handles text extraction from PDF documents (pdfplumber) and Image OCR (pytesseract + Pillow).

System Dependency Note:
Tesseract OCR must be installed on the host operating system in addition to the Python package:
Debian / Ubuntu:
    sudo apt-get update && sudo apt-get install -y tesseract-ocr
macOS (Homebrew):
    brew install tesseract
"""

import io
import logging
from PIL import Image, UnidentifiedImageError
import pdfplumber
import pytesseract

logger = logging.getLogger("extraction_service")


class ExtractionError(Exception):
    """Base exception for document extraction failures (corrupted files, parsing crashes)."""
    pass


class NoTextFoundError(ExtractionError):
    """Raised when a document or image contains no extractable or readable text."""
    pass


def extract_pdf_text(file_bytes: bytes) -> str:
    """
    Extract text page-by-page from a PDF document using pdfplumber,
    preserving paragraph breaks between pages with double newlines.

    Raises:
        NoTextFoundError: If the PDF contains no readable text layer (e.g. scanned image-only PDF).
        ExtractionError: If the PDF is corrupted or unreadable.
    """
    try:
        page_texts: list[str] = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            if not pdf.pages:
                raise NoTextFoundError("The PDF document contains no pages.")

            for page_num, page in enumerate(pdf.pages, start=1):
                try:
                    text = page.extract_text()
                    if text and text.strip():
                        page_texts.append(text.strip())
                except Exception as page_err:
                    logger.warning("Error extracting text from PDF page %d: %s", page_num, page_err)

        joined_text = "\n\n".join(page_texts).strip()

        if not joined_text:
            raise NoTextFoundError(
                "No readable text found in this PDF. It may be a scanned document without a text layer."
            )

        return joined_text

    except NoTextFoundError:
        raise
    except Exception as exc:
        logger.error("Failed to parse PDF document: %s", exc, exc_info=True)
        raise ExtractionError(f"Could not read PDF document: {exc}") from exc


def extract_image_text(file_bytes: bytes) -> str:
    """
    Extract text from an image (JPEG/PNG) using Pillow and Tesseract OCR.
    Applies grayscale preprocessing to enhance OCR accuracy.

    Raises:
        NoTextFoundError: If no text was recognized in the image.
        ExtractionError: If the image is unreadable or OCR engine failed.
    """
    try:
        try:
            image = Image.open(io.BytesIO(file_bytes))
        except UnidentifiedImageError as img_err:
            raise ExtractionError("Invalid or corrupted image format.") from img_err

        # Preprocessing: Convert image to grayscale to improve OCR clarity on scanned documents
        grayscale_image = image.convert("L")

        try:
            raw_text = pytesseract.image_to_string(grayscale_image)
        except pytesseract.TesseractNotFoundError as t_err:
            logger.error("Tesseract OCR binary not found on system: %s", t_err)
            raise ExtractionError("Tesseract OCR engine is not installed on the server.") from t_err
        except Exception as ocr_err:
            logger.error("Tesseract OCR processing failed: %s", ocr_err, exc_info=True)
            raise ExtractionError(f"OCR processing error: {ocr_err}") from ocr_err

        cleaned_text = raw_text.strip() if raw_text else ""

        if not cleaned_text:
            raise NoTextFoundError(
                "No readable text found in this image. Please ensure the image is clear and contains text."
            )

        return cleaned_text

    except (NoTextFoundError, ExtractionError):
        raise
    except Exception as exc:
        logger.error("Unexpected error during image extraction: %s", exc, exc_info=True)
        raise ExtractionError(f"Failed to process image: {exc}") from exc


def extract_text(file_bytes: bytes, file_type: str) -> str:
    """
    Dispatcher function to extract raw text based on file type.

    Args:
        file_bytes: Raw binary content of uploaded document.
        file_type: "pdf" or "image".

    Returns:
        Extracted text string.

    Raises:
        NoTextFoundError: If no readable text exists in document.
        ExtractionError: If extraction fails due to corruption or parsing errors.
    """
    if file_type == "pdf":
        return extract_pdf_text(file_bytes)
    elif file_type == "image":
        return extract_image_text(file_bytes)
    else:
        raise ExtractionError(f"Unsupported file type '{file_type}' for extraction.")
