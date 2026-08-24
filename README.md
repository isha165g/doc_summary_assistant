# Document Summary Assistant

> A full-stack application for uploading documents (PDFs and images), extracting text via parsing/OCR, and generating AI summaries.

*Note: This repository currently contains **Phase 3 of 6** — Real text extraction via `pdfplumber` and Image OCR via `pytesseract` + `Pillow` (LLM summarization pipeline arriving in Phase 4).*

---

## Project Structure

```
├── backend/
│   ├── main.py                  # FastAPI application registering /api/health & /api/summarize
│   ├── requirements.txt         # Dependencies (fastapi, uvicorn, pdfplumber, pytesseract, Pillow)
│   ├── routes/
│   │   ├── __init__.py
│   │   └── summarize.py         # POST /api/summarize (validation, extraction call, 422 handling)
│   └── services/
│       ├── __init__.py
│       └── extraction.py        # PDF text parsing + Image OCR with grayscale preprocessing
├── frontend/
│   ├── index.html               # HTML entry point
│   ├── package.json             # Node.js dependencies and scripts
│   ├── vite.config.js           # Vite configuration
│   ├── tailwind.config.js       # Tailwind CSS configuration
│   ├── postcss.config.js        # PostCSS configuration
│   ├── .env.example             # Environment variables template (VITE_API_URL)
│   └── src/
│       ├── main.jsx             # React entry point
│       ├── App.jsx              # Phase 3 UI (File upload, 422 error banner, real extracted preview)
│       ├── index.css            # Tailwind styles
│       └── components/          # Component directory
└── README.md                    # Project documentation
```

---

## Setup & Running Locally

### 1. System Dependency for Image OCR

In addition to Python packages, Tesseract OCR must be installed on your operating system:

- **Debian / Ubuntu**:
  ```bash
  sudo apt-get update && sudo apt-get install -y tesseract-ocr
  ```
- **macOS (Homebrew)**:
  ```bash
  brew install tesseract
  ```
- **Windows**:
  Download and install the Tesseract executable from GitHub / UB-Mannheim and add it to your System PATH.

---

### 2. Backend (FastAPI + Python)

#### Prerequisites
- Python 3.9+
- `pip`

#### Steps

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   - **macOS / Linux**:
     ```bash
     python -m venv venv
     source venv/bin/activate
     ```
   - **Windows**:
     ```bash
     python -m venv venv
     venv\Scripts\activate
     ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the FastAPI development server:
   ```bash
   uvicorn main:app --reload
   ```
   The backend API will run at `http://localhost:8000`. You can visit:
   - Health check: [http://localhost:8000/api/health](http://localhost:8000/api/health)
   - Interactive Swagger docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 3. Frontend (React + Vite + Tailwind CSS)

#### Prerequisites
- Node.js 18+
- `npm`

#### Steps

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. (Optional) Set up environment variables:
   ```bash
   cp .env.example .env
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend application will run at [http://localhost:5173](http://localhost:5173).

---

## Test Files & Verification

### How to Create or Acquire the 3 Test Files

1. **Test File A: Text-Based PDF**
   - Save any article or generate a sample PDF using Python:
     ```python
     # Quick one-liner with reportlab or print to PDF in browser
     python -c "from reportlab.pdfgen import canvas; c = canvas.Canvas('sample_text.pdf'); c.drawString(100, 750, 'Artificial Intelligence in Document Analysis. This document contains readable text for Phase 3 extraction testing.'); c.save()"
     ```
     *(Or simply use the "Print to PDF" feature in your browser on any article/page).*

2. **Test File B: Scanned / Photographed Document Image with Text**
   - Take a clear photo or screenshot of a document with visible text and save as `document_scan.png` or `document_scan.jpg`.

3. **Test File C: Non-Text / Blank Document (422 Error Verification)**
   - Create a blank/landscape image or blank PDF:
     ```bash
     # Create a blank 100x100 PNG using ImageMagick/Python
     python -c "from PIL import Image; Image.new('RGB', (200, 200), color='white').save('blank.png')"
     ```

---

## cURL Testing Commands

### 1. Extract Text from PDF (200 OK)
```bash
curl -X POST "http://localhost:8000/api/summarize" \
  -F "file=@sample_text.pdf;type=application/pdf" \
  -F "length=medium"
```
**Expected Response:**
```json
{
  "filename": "sample_text.pdf",
  "file_type": "pdf",
  "length": "medium",
  "summary": "Artificial Intelligence in Document Analysis. This document contains readable text for Phase 3 extraction testing.",
  "key_points": [
    "Extracted 14 words across the document.",
    "Text parsing and OCR extraction successfully completed.",
    "Phase 4 will generate intelligent AI summaries and key insights from this text."
  ],
  "word_count": 14
}
```

### 2. Extract Text from Image via OCR (200 OK)
```bash
curl -X POST "http://localhost:8000/api/summarize" \
  -F "file=@document_scan.png;type=image/png" \
  -F "length=short"
```

### 3. Blank / Non-Text Document (422 Unprocessable Entity)
```bash
curl -i -X POST "http://localhost:8000/api/summarize" \
  -F "file=@blank.png;type=image/png"
```
**Expected Response:**
```json
{
  "detail": "No readable text found in this document. Please try a clearer scan or a different file."
}
```

### 4. Oversized File (> 10MB) (413 Payload Too Large)
```bash
dd if=/dev/zero of=oversized.pdf bs=1M count=11
curl -i -X POST "http://localhost:8000/api/summarize" \
  -F "file=@oversized.pdf;type=application/pdf"
```

### 5. Unsupported Media Type (415 Unsupported Media Type)
```bash
curl -i -X POST "http://localhost:8000/api/summarize" \
  -F "file=@spreadsheet.xlsx;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
```
