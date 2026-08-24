"""
Extraction service for Document Summary Assistant.
Handles hybrid text extraction from PDF documents (pdfplumber digital extraction + pdf2image OCR fallback)
and Image OCR (OpenCV preprocessing pipeline + pytesseract with confidence scoring & PSM fallbacks).

System Dependencies:
1. Tesseract OCR (tesseract-ocr, tesseract-ocr-eng)
2. Poppler Utilities (poppler-utils for pdf2image)
"""

import io
import logging
from typing import Literal
import numpy as np
from PIL import Image, UnidentifiedImageError
import pdfplumber
import pytesseract
from pytesseract import Output

try:
    import cv2
except ImportError:
    cv2 = None

try:
    import pdf2image
except ImportError:
    pdf2image = None

logger = logging.getLogger("extraction_service")


class ExtractionError(Exception):
    """Base exception for document extraction failures (corrupted files, parsing crashes)."""
    pass


class NoTextFoundError(ExtractionError):
    """Raised when a document or image contains no extractable or readable text."""
    pass


# =====================================================================
# 1. MODULAR IMAGE PREPROCESSING PIPELINE (OpenCV + NumPy)
# =====================================================================

def convert_to_grayscale(image: np.ndarray | Image.Image) -> np.ndarray:
    """
    Step 1a: Convert PIL Image or OpenCV image array to 8-bit single-channel grayscale.
    """
    if isinstance(image, Image.Image):
        # Convert PIL Image directly to grayscale numpy array
        return np.array(image.convert("L"))

    if not isinstance(image, np.ndarray):
        raise ValueError(f"Expected PIL Image or np.ndarray, got {type(image)}")

    if len(image.shape) == 2:
        return image.copy()  # Already grayscale

    if len(image.shape) == 3:
        channels = image.shape[2]
        if channels == 4:
            return cv2.cvtColor(image, cv2.COLOR_BGRA2GRAY) if cv2 else np.array(Image.fromarray(image).convert("L"))
        elif channels == 3:
            return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if cv2 else np.array(Image.fromarray(image).convert("L"))

    return image


def upscale_if_needed(image: np.ndarray, min_dimension: int = 1500, scale_factor: float = 2.0) -> np.ndarray:
    """
    Step 1b: Upscale low-resolution images using high-quality Lanczos resampling.
    Tesseract accuracy drops significantly when characters are under ~25-30px in height.
    """
    if image is None or image.size == 0:
        return image

    h, w = image.shape[:2]
    min_dim = min(h, w)

    if min_dim < min_dimension and scale_factor > 1.0:
        new_w = int(w * scale_factor)
        new_h = int(h * scale_factor)
        logger.debug("Upscaling image from %dx%d to %dx%d (Lanczos filter)", w, h, new_w, new_h)
        if cv2:
            return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
        else:
            pil_img = Image.fromarray(image)
            return np.array(pil_img.resize((new_w, new_h), resample=Image.Resampling.LANCZOS))

    return image


def denoise_image(image: np.ndarray, h: float = 10.0) -> np.ndarray:
    """
    Step 1d: Denoise image to remove scan grain and camera sensor noise before binarization.
    Uses Fast Non-Local Means Denoising or median blur.
    """
    if image is None or image.size == 0:
        return image

    if cv2:
        try:
            return cv2.fastNlMeansDenoising(image, None, h=h, templateWindowSize=7, searchWindowSize=21)
        except Exception as e:
            logger.debug("fastNlMeansDenoising failed, applying medianBlur fallback: %s", e)
            return cv2.medianBlur(image, 3)

    return image


def deskew_image(image: np.ndarray, max_angle: float = 45.0) -> np.ndarray:
    """
    Step 1e: Detect and correct skew/rotation angle using minimum bounding area of text contours.
    Corrects slight camera tilts and misaligned flatbed scans up to max_angle degrees.
    """
    if image is None or image.size == 0 or not cv2:
        return image

    try:
        # Binarize inverted so text pixels are white (>0)
        thresh = cv2.threshold(image, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]
        coords = np.column_stack(np.where(thresh > 0))

        if len(coords) < 100:
            return image  # Insufficient text contours to reliably compute angle

        # minAreaRect returns ((center_x, center_y), (width, height), angle)
        angle = cv2.minAreaRect(coords)[-1]

        # Normalize angle depending on OpenCV version range
        if angle < -45.0:
            angle = -(90.0 + angle)
        elif angle > 45.0:
            angle = 90.0 - angle
        else:
            angle = -angle

        # Filter out negligible skew or extreme orientations
        if abs(angle) > 0.5 and abs(angle) <= max_angle:
            logger.debug("Deskewing image by %.2f degrees", angle)
            h, w = image.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            # Use BORDER_REPLICATE or constant white border to avoid dark borders
            rotated = cv2.warpAffine(
                image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
            )
            return rotated

        return image
    except Exception as e:
        logger.debug("Deskew detection encountered error, preserving orientation: %s", e)
        return image


def binarize_image(image: np.ndarray, method: Literal["adaptive", "otsu"] = "adaptive") -> np.ndarray:
    """
    Step 1c: Contrast enhancement and binarization.
    - 'adaptive': Gaussian adaptive thresholding to handle non-uniform shadows and lighting gradients.
    - 'otsu': Global Otsu binarization for clean high-contrast documents.
    """
    if image is None or image.size == 0:
        return image

    if not cv2:
        # Fallback to PIL autocontrast
        pil_img = Image.fromarray(image)
        return np.array(pil_img.point(lambda p: 255 if p > 128 else 0))

    if method == "adaptive":
        # Block size 21, constant C=11 handles varying shadows on paper
        return cv2.adaptiveThreshold(
            image, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 11
        )
    else:
        return cv2.threshold(image, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]


def preprocess_image_for_ocr(
    image: Image.Image | np.ndarray,
    apply_upscale: bool = True,
    apply_denoise: bool = True,
    apply_deskew: bool = True,
    binarize_method: Literal["adaptive", "otsu"] = "adaptive",
    scale_factor: float = 2.0,
) -> np.ndarray:
    """
    Full Image Preprocessing Pipeline:
    1. Grayscale conversion
    2. Upscaling (if image smaller dimension < 1500px)
    3. Denoising
    4. Deskewing
    5. Adaptive or Otsu Binarization
    """
    # 1. Grayscale
    gray = convert_to_grayscale(image)

    # 2. Upscaling
    if apply_upscale:
        gray = upscale_if_needed(gray, min_dimension=1500, scale_factor=scale_factor)

    # 3. Denoising
    if apply_denoise:
        gray = denoise_image(gray)

    # 4. Deskew
    if apply_deskew:
        gray = deskew_image(gray)

    # 5. Contrast / Binarization
    processed = binarize_image(gray, method=binarize_method)

    return processed


# =====================================================================
# 2. TESSERACT CONFIGURATION & OCR EXECUTION WITH CONFIDENCE
# =====================================================================

def calculate_ocr_confidence(data_dict: dict) -> float:
    """
    Compute the average word-level confidence score from pytesseract Output.DICT.
    Filters out background noise tokens (conf == -1 or whitespace strings).
    """
    confidences = []
    confs = data_dict.get("conf", [])
    texts = data_dict.get("text", [])

    for conf, text in zip(confs, texts):
        try:
            c_val = float(conf)
            if c_val >= 0 and str(text).strip():
                confidences.append(c_val)
        except (ValueError, TypeError):
            continue

    if not confidences:
        return 0.0

    return float(sum(confidences) / len(confidences))


def perform_ocr(
    image_array: np.ndarray | Image.Image,
    psm: int = 3,
    oem: int = 3,
    lang: str = "eng",
) -> tuple[str, float]:
    """
    Execute Tesseract OCR with explicit configuration:
    - --psm: Page Segmentation Mode (3 = Fully automatic page segmentation; 6 = Single uniform block)
    - --oem: OCR Engine Mode (3 = Default LSTM)
    - lang: Explicit language parameter ('eng')

    Returns:
        tuple[str, float]: (recognized_text, average_confidence)
    """
    try:
        config = f"--oem {oem} --psm {psm}"
        # Extract word data with confidence mapping
        data = pytesseract.image_to_data(image_array, lang=lang, config=config, output_type=Output.DICT)
        avg_confidence = calculate_ocr_confidence(data)

        # Extract full formatted text
        text = pytesseract.image_to_string(image_array, lang=lang, config=config)
        return (text.strip() if text else "", avg_confidence)

    except pytesseract.TesseractNotFoundError as t_err:
        logger.error("Tesseract OCR binary not found on system: %s", t_err)
        raise ExtractionError("Tesseract OCR engine is not installed on the server.") from t_err
    except Exception as err:
        logger.warning("Tesseract execution failed (psm=%d): %s", psm, err)
        return ("", 0.0)


def perform_ocr_with_fallback(image: Image.Image | np.ndarray) -> tuple[str, float]:
    """
    Robust OCR extraction workflow:
    1. Primary Pass: Full preprocessing (Adaptive binarization + denoise + deskew) with PSM 3 (auto segmentation).
    2. Quality Evaluation: Check word yield and average confidence score.
    3. Fallback Pass 1 (Uniform block): If yield is low, retry with PSM 6.
    4. Fallback Pass 2 (Otsu / No heavy denoise): If still low confidence (<60), retry with Otsu binarization.
    5. Server-side Quality Warning: Logs a warning if final confidence remains < 60.
    """
    # Primary Pass: Standard Preprocessing Pipeline + PSM 3
    preprocessed_1 = preprocess_image_for_ocr(
        image,
        apply_upscale=True,
        apply_denoise=True,
        apply_deskew=True,
        binarize_method="adaptive",
        scale_factor=2.0,
    )
    text_1, conf_1 = perform_ocr(preprocessed_1, psm=3, oem=3, lang="eng")
    word_count_1 = len(text_1.split())

    best_text = text_1
    best_conf = conf_1

    # Check if retry is warranted (very few words extracted or low confidence < 60)
    if word_count_1 < 10 or conf_1 < 60.0:
        logger.info(
            "Primary OCR pass yielded low confidence (%.1f%%, %d words). Running PSM 6 fallback...",
            conf_1, word_count_1,
        )

        # Fallback Pass 1: Try PSM 6 (single uniform text block) on preprocessed image
        text_psm6, conf_psm6 = perform_ocr(preprocessed_1, psm=6, oem=3, lang="eng")
        word_count_psm6 = len(text_psm6.split())

        if word_count_psm6 > word_count_1 or conf_psm6 > best_conf:
            best_text = text_psm6
            best_conf = conf_psm6

        # Fallback Pass 2: If still low confidence or empty, try Otsu without heavy denoising & 2.5x upscale
        if len(best_text.split()) < 10 or best_conf < 60.0:
            logger.info("Running secondary preprocessing pass (Otsu thresholding + 2.5x upscale)...")
            preprocessed_2 = preprocess_image_for_ocr(
                image,
                apply_upscale=True,
                apply_denoise=False,
                apply_deskew=True,
                binarize_method="otsu",
                scale_factor=2.5,
            )
            text_otsu, conf_otsu = perform_ocr(preprocessed_2, psm=3, oem=3, lang="eng")
            word_count_otsu = len(text_otsu.split())

            if word_count_otsu > len(best_text.split()) or conf_otsu > best_conf:
                best_text = text_otsu
                best_conf = conf_otsu

    # Quality Check signal: Log server-side warning if confidence is below 60
    if best_conf < 60.0 and best_text:
        logger.warning(
            "OCR extraction completed with low confidence score: %.1f%% (%d words recognized). Document may have low contrast or heavy compression.",
            best_conf, len(best_text.split()),
        )
    else:
        logger.info("OCR extraction completed successfully: %.1f%% confidence (%d words).", best_conf, len(best_text.split()))

    return (best_text, best_conf)


# Backwards compatibility helper for existing callers
def perform_ocr_on_pil_image(image: Image.Image) -> str:
    """Wrapper around perform_ocr_with_fallback for backwards compatibility."""
    text, _ = perform_ocr_with_fallback(image)
    return text


# =====================================================================
# 3. PDF EXTRACTION & SCANNED PDF FALLBACK
# =====================================================================

def extract_scanned_pdf_pages_via_ocr(file_bytes: bytes) -> str:
    """
    Fallback extraction for scanned PDFs (PDFs without a digital text layer).
    Converts PDF pages to high-resolution images via pdf2image (poppler-utils)
    and processes each through the OpenCV preprocessing + OCR pipeline.
    """
    page_texts: list[str] = []

    # Attempt 1: pdf2image (highest fidelity rasterization via poppler)
    if pdf2image is not None:
        try:
            logger.info("Converting scanned PDF pages to images using pdf2image (200 DPI)...")
            images = pdf2image.convert_from_bytes(file_bytes, dpi=200)
            for idx, img in enumerate(images, start=1):
                logger.info("Processing scanned PDF page %d of %d with OCR pipeline...", idx, len(images))
                page_text, page_conf = perform_ocr_with_fallback(img)
                if page_text:
                    page_texts.append(page_text)
            if page_texts:
                return "\n\n".join(page_texts).strip()
        except Exception as p2i_err:
            logger.warning("pdf2image rendering failed (poppler-utils missing or error): %s. Falling back to pdfplumber rasterizer...", p2i_err)

    # Attempt 2: pdfplumber page.to_image rasterization fallback
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for idx, page in enumerate(pdf.pages, start=1):
                try:
                    page_img = page.to_image(resolution=200)
                    if page_img and hasattr(page_img, "original"):
                        page_text, page_conf = perform_ocr_with_fallback(page_img.original)
                        if page_text:
                            page_texts.append(page_text)
                except Exception as raster_err:
                    logger.debug("Failed rasterizing page %d: %s", idx, raster_err)
    except Exception as e:
        logger.error("Failed in fallback PDF page rasterization: %s", e)

    return "\n\n".join(page_texts).strip()


def extract_pdf_text(file_bytes: bytes) -> str:
    """
    Extract text page-by-page from a PDF document:
    1. Extracts digital selectable text layer with pdfplumber.
    2. If the entire PDF has empty or near-empty text (<15 words across all pages),
       it automatically triggers the scanned PDF OCR fallback pipeline (pdf2image + OpenCV preprocessing).
    3. For hybrid documents with mixed digital text and embedded images, merges OCR text cleanly.

    Raises:
        NoTextFoundError: If no readable digital or OCR text could be found across the PDF.
        ExtractionError: If the PDF is corrupted or unreadable.
    """
    try:
        page_texts: list[str] = []
        total_digital_words = 0

        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            if not pdf.pages:
                raise NoTextFoundError("The PDF document contains no pages.")

            for page_num, page in enumerate(pdf.pages, start=1):
                page_extracted_parts: list[str] = []

                # 1. Digital text layer
                try:
                    digital_text = page.extract_text()
                    if digital_text and digital_text.strip():
                        clean_digital = digital_text.strip()
                        page_extracted_parts.append(clean_digital)
                        total_digital_words += len(clean_digital.split())
                except Exception as text_err:
                    logger.warning("Error extracting digital text on PDF page %d: %s", page_num, text_err)
                    digital_text = ""

                # 2. Check if specific page needs embedded image OCR
                has_digital_text = bool(digital_text and len(digital_text.strip().split()) > 15)
                has_images = bool(getattr(page, "images", None))

                if (not has_digital_text or has_images) and total_digital_words >= 15:
                    try:
                        page_img = page.to_image(resolution=150)
                        if page_img and hasattr(page_img, "original"):
                            ocr_result, _ = perform_ocr_with_fallback(page_img.original)
                            if ocr_result:
                                if not digital_text:
                                    page_extracted_parts.append(ocr_result)
                                elif ocr_result not in digital_text and len(ocr_result) > len(digital_text) * 0.5:
                                    page_extracted_parts.append(f"[Scanned/Image Text]:\n{ocr_result}")
                    except Exception as ocr_page_err:
                        logger.debug("Embedded image OCR on page %d skipped/failed: %s", page_num, ocr_page_err)

                if page_extracted_parts:
                    page_texts.append("\n\n".join(page_extracted_parts))

        # Check if PDF was a pure scan (no digital text layer found)
        if total_digital_words < 15:
            logger.info("PDF has near-zero digital text (%d words). Triggering scanned PDF OCR fallback pipeline...", total_digital_words)
            scanned_ocr_text = extract_scanned_pdf_pages_via_ocr(file_bytes)
            if scanned_ocr_text:
                return scanned_ocr_text

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


# =====================================================================
# 4. IMAGE EXTRACTION ENTRYPOINT
# =====================================================================

def extract_image_text(file_bytes: bytes) -> str:
    """
    Extract text from an image (JPEG/PNG) using OpenCV preprocessing and Tesseract OCR with fallback.
    Applies grayscale, upscaling, denoising, deskewing, and adaptive binarization.

    Raises:
        NoTextFoundError: If no text was recognized in the image.
        ExtractionError: If the image is unreadable or OCR engine failed.
    """
    try:
        try:
            image = Image.open(io.BytesIO(file_bytes))
        except UnidentifiedImageError as img_err:
            raise ExtractionError("Invalid or corrupted image format.") from img_err

        cleaned_text, avg_confidence = perform_ocr_with_fallback(image)

        if not cleaned_text or len(cleaned_text.strip()) == 0:
            raise NoTextFoundError(
                "No readable text found in this image. Please ensure the image is clear and contains readable text."
            )

        return cleaned_text

    except (NoTextFoundError, ExtractionError):
        raise
    except Exception as exc:
        logger.error("Unexpected error during image extraction: %s", exc, exc_info=True)
        raise ExtractionError(f"Failed to process image: {exc}") from exc


# =====================================================================
# 5. DISPATCHER
# =====================================================================

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
