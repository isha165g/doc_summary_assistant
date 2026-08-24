# Document Summary Assistant

> A full-stack application for uploading documents (PDFs and images), extracting text via parsing/OCR, and generating AI summaries.

*Note: This repository currently contains **Phase 2 of 6** — File upload pipeline & contract verification (real text extraction & AI summarization arriving in Phase 3 & 4).*

---

## Project Structure

```
├── backend/
│   ├── main.py                  # FastAPI application registering /api/health & /api/summarize
│   ├── requirements.txt         # Python dependencies (fastapi, uvicorn, python-multipart)
│   ├── routes/
│   │   ├── __init__.py
│   │   └── summarize.py         # POST /api/summarize with validation & stubbed response
│   └── services/
│       ├── __init__.py
│       └── extraction.py        # extract_text stub signature ready for Phase 3
├── frontend/
│   ├── index.html               # HTML entry point
│   ├── package.json             # Node.js dependencies and scripts
│   ├── vite.config.js           # Vite configuration
│   ├── tailwind.config.js       # Tailwind CSS configuration
│   ├── postcss.config.js        # PostCSS configuration
│   ├── .env.example             # Environment variables template (VITE_API_URL)
│   └── src/
│       ├── main.jsx             # React entry point
│       ├── App.jsx              # Phase 2 UI (File upload + Length dropdown + Summary result)
│       ├── index.css            # Tailwind styles
│       └── components/          # Component directory
└── README.md                    # Project documentation
```

---

## API Endpoints

| Method | Endpoint | Description | Payload / Query |
|---|---|---|---|
| `GET` | `/api/health` | Service health status | None |
| `POST` | `/api/summarize` | Validate & upload document, returns summary contract | `multipart/form-data`: `file` (PDF/JPEG/PNG, max 10MB), `length` (`short`\|`medium`\|`long`) |

---

## Direct Backend Testing with cURL

You can test the validation and stubbed response contract directly against the FastAPI backend:

### 1. Valid PDF Upload
```bash
curl -X POST "http://localhost:8000/api/summarize" \
  -F "file=@sample.pdf;type=application/pdf" \
  -F "length=medium"
```
**Expected (200 OK):**
```json
{
  "filename": "sample.pdf",
  "file_type": "pdf",
  "length": "medium",
  "summary": "This is a placeholder summary. Real extraction and summarization will be added in later phases.",
  "key_points": [
    "Placeholder key point 1",
    "Placeholder key point 2",
    "Placeholder key point 3"
  ],
  "word_count": 0
}
```

### 2. Unsupported File Type (e.g. .txt / text/plain)
```bash
curl -i -X POST "http://localhost:8000/api/summarize" \
  -F "file=@notes.txt;type=text/plain"
```
**Expected (415 Unsupported Media Type):**
```json
{
  "detail": "Unsupported file type 'text/plain'. Only application/pdf, image/jpeg, and image/png are supported."
}
```

### 3. Oversized File (> 10MB)
```bash
# Create a dummy 11MB file to test size limits
dd if=/dev/zero of=oversized.pdf bs=1M count=11

curl -i -X POST "http://localhost:8000/api/summarize" \
  -F "file=@oversized.pdf;type=application/pdf"
```
**Expected (413 Payload Too Large):**
```json
{
  "detail": "File size (11.00 MB) exceeds maximum allowed size of 10 MB."
}
```

---

## Setup & Running Locally

### 1. Backend (FastAPI + Python)

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

### 2. Frontend (React + Vite + Tailwind CSS)

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
   By default, `VITE_API_URL` is set to `http://localhost:8000`.

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend application will run at [http://localhost:5173](http://localhost:5173).

