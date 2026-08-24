"""
Extraction service for Document Summary Assistant (Phase 3).
Handles hybrid text extraction from PDF documents (pdfplumber + OCR for scanned pages/embedded images)
and Image OCR (pytesseract + Pillow with preprocessing).

System Dependency Note:
Tesseract OCR must be installed on the host operating system in addition to the Python package:
Debian / Ubuntu:
    sudo apt-get update && sudo apt-get install -y tesseract-ocr
macOS (Homebrew):
    brew install tesseract
"""

import io
import logging
from PIL import Image, ImageOps, UnidentifiedImageError
import pdfplumber
import pytesseract

logger = logging.getLogger("extraction_service")


class ExtractionError(Exception):
    """Base exception for document extraction failures (corrupted files, parsing crashes)."""
    pass


class NoTextFoundError(ExtractionError):
    """Raised when a document or image contains no extractable or readable text."""
    pass


def perform_ocr_on_pil_image(image: Image.Image) -> str:
    """
    Helper function to run OCR on a PIL Image with grayscale preprocessing.
    """
    try:
        # Convert to grayscale to enhance OCR contrast
        gray = image.convert("L")
        # Auto-contrast to make faint scanned text darker and clearer
        enhanced = ImageOps.autocontrast(gray)
        ocr_text = pytesseract.image_to_string(enhanced)
        return ocr_text.strip() if ocr_text else ""
    except pytesseract.TesseractNotFoundError as t_err:
        logger.error("Tesseract OCR binary not found on system: %s", t_err)
        raise ExtractionError("Tesseract OCR engine is not installed on the server.") from t_err
    except Exception as err:
        logger.warning("OCR pass failed on image: %s", err)
        return ""


def extract_pdf_text(file_bytes: bytes) -> str:
    """
    Extract text page-by-page from a PDF document using a hybrid approach:
    1. Extracts digital selectable text layer with pdfplumber.
    2. If a page has little/no digital text or contains embedded images/scans,
       renders the page or embedded images to run Tesseract OCR.
    3. Merges digital text with OCR text cleanly to avoid losing mixed content.

    Raises:
        NoTextFoundError: If no readable digital or OCR text could be found across the PDF.
        ExtractionError: If the PDF is corrupted or unreadable.
    """
    try:
        page_texts: list[str] = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            if not pdf.pages:
                raise NoTextFoundError("The PDF document contains no pages.")

            for page_num, page in enumerate(pdf.pages, start=1):
                page_extracted_parts: list[str] = []

                # 1. Digital text layer
                try:
                    digital_text = page.extract_text()
                    if digital_text and digital_text.strip():
                        page_extracted_parts.append(digital_text.strip())
                except Exception as text_err:
                    logger.warning("Error extracting digital text on PDF page %d: %s", page_num, text_err)
                    digital_text = ""

                # 2. Check if page needs OCR (scanned page or embedded images)
                has_digital_text = bool(digital_text and len(digital_text.strip().split()) > 15)
                has_images = bool(getattr(page, "images", None))

                # If the page has few/no digital words, or has images, run OCR pass
                if not has_digital_text or has_images:
                    try:
                        # Render page as image (resolution 150-200 DPI is optimal for OCR)
                        page_img = page.to_image(resolution=150)
                        if page_img and hasattr(page_img, "original"):
                            ocr_result = perform_ocr_on_pil_image(page_img.original)
                            if ocr_result:
                                # Avoid duplicating text if OCR is mostly identical to digital text
                                if not digital_text:
                                    page_extracted_parts.append(ocr_result)
                                elif ocr_result not in digital_text and len(ocr_result) > len(digital_text) * 0.5:
                                    # If OCR found substantial text not present digitally (e.g. text in an embedded graphic)
                                    page_extracted_parts.append(f"[Scanned/Image Text]:\n{ocr_result}")
                    except Exception as ocr_page_err:
                        logger.debug("Page image rendering for OCR skipped/failed on page %d: %s", page_num, ocr_page_err)

                if page_extracted_parts:
                    page_texts.append("\n\n".join(page_extracted_parts))

        joined_text = "\n\n".join(page_texts).strip()

        if not joined_text:
            raise NoTextFoundError(
                "No readable text found in this PDF. Both digital text extraction and OCR found no readable content."
            )

        return joined_text

    except NoTextFoundError:
        raise
    except ExtractionError:
        raise
    except Exception as exc:
        logger.error("Failed to parse PDF document: %s", exc, exc_info=True)
        raise ExtractionError(f"Could not read PDF document: {exc}") from exc


def extract_image_text(file_bytes: bytes) -> str:
    """
    Extract text from an image (JPEG/PNG) using Pillow and Tesseract OCR.
    Applies grayscale and auto-contrast preprocessing to enhance OCR accuracy.

    Raises:
        NoTextFoundError: If no text was recognized in the image.
        ExtractionError: If the image is unreadable or OCR engine failed.
    """
    try:
        try:
            image = Image.open(io.BytesIO(file_bytes))
        except UnidentifiedImageError as img_err:
            raise ExtractionError("Invalid or corrupted image format.") from img_err

        # Preprocessing: Convert image to grayscale + auto-contrast
        cleaned_text = perform_ocr_on_pil_image(image)

        if not cleaned_text:
            raise NoTextFoundError(
                "No readable text found in this image. Please ensure the image is clear and contains readable text."
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
