"""
Extraction service for Document Summary Assistant.
Phase 3 will implement text extraction for PDFs (e.g. PyMuPDF/pdfplumber) and images (OCR).
"""


def extract_text(file_bytes: bytes, file_type: str) -> str:
    """
    Extract raw text from PDF or image file bytes.

    Args:
        file_bytes: Raw binary content of the uploaded file.
        file_type: Type of document ("pdf" or "image").

    Returns:
        Extracted text string from the document.
    """
    # Phase 3 stub: Real extraction logic will be implemented here.
    pass
