# Document Summary Assistant

> Document Summary Assistant solves information overload by transforming dense PDFs and unindexed scanned images into structured, executive-level takeaways in seconds. To balance speed, precision, and architectural simplicity, paired a React (Vite) and Tailwind CSS frontend with an asynchronous FastAPI backend.
> The text extraction pipeline implements intelligent branching: digital PDFs are parsed directly with pdfplumber, while scanned images undergo PIL and OpenCV preprocessing (Lanczos upscaling, Otsu/adaptive binarization, median denoising, and minAreaRect deskewing) before character recognition via Tesseract OCR. For summarization, Groq’s ultra-fast LLaMA 3.3 70B inference engine was selected for its near-instant token generation on free-tier limits.
> Strict time budgeting guided deliberate scoping decisions: authentication, user databases, and multi-file batching were intentionally deferred in favor of a rock-solid single-document pipeline. Client-side file size (up to 10MB) and MIME-type gating prevent wasteful network roundtrips, while the backend is fully containerized with Docker for deterministic deployment across Render and Vercel.

---

## 🌐 Live URLs

- **Live Application (Frontend)**: [Vercel](https://doc-summary-assistant-smoky.vercel.app/)
- **API Health Check (Backend)**: [Render/api/health](https://doc-summary-assistant-k00l.onrender.com/api/health)
- **API Interactive Docs (Swagger)**: [Swagger/docs](https://doc-summary-assistant-k00l.onrender.com/docs)

---

## 🚀 Enhancements Beyond Core Requirements

1. **Real-Time Streaming Progress (Server-Sent Events)**:
   - Added `/api/summarize-stream` delivering live pipeline events (`validating` ➔ `extracting` ➔ `extracted` with real word count ➔ `classifying` ➔ `summarizing` ➔ `complete`).
   - Frontend dynamically updates progress labels, word count metrics, and animation states with automatic fallback to standard REST endpoints.

2. **Document-Type-Aware Summarization Prompts**:
   - Automated heuristic document classification into `academic/research`, `business/report`, `legal/contract`, and `general/other`.
   - Domain-specific system prompts dynamically calibrate LLM attention (e.g. focusing on empirical methodology for academic papers vs. financial metrics & operational KPIs for business reports vs. liabilities & covenants for legal contracts).

3. **In-Memory Cache for Duplicate Uploads**:
   - SHA-256 process-local caching mechanism keyed by document hash and summary length.
   - Eliminates redundant OCR computing and preserves Groq token quotas on repeated runs with instant response delivery (`cached: true`).

4. **Rate Limiting Protection**:
   - In-memory sliding-window rate limiter on summarization endpoints (10 requests/min per IP) to guard against API quota exhaustion and denial-of-service spikes.

5. **Multi-Format Export & Print Actions**:
   - Instant client-side download options for `.txt` (structured plaintext ledger) and `.md` (Markdown document with metadata tags), alongside print-optimized stylesheet triggers.

---

## 🛠️ Tech Stack & Justifications

| Layer | Technology | Justification |
|---|---|---|
| **Frontend Framework** | **React 18 (Vite)** | Lightning-fast development builds, responsive component architecture, and lightweight client bundling. |
| **Styling** | **Tailwind CSS** | Utility-first styling enabling a clean, accessible layout with WCAG-compliant color contrast and mobile responsiveness. |
| **Drag & Drop** | **react-dropzone** | Accessible, intuitive file dropzone with instantaneous client-side validation for file size and MIME types. |
| **Icons** | **Lucide React** | Crisp, lightweight, tree-shakeable SVG icons for document types, loaders, and status alerts. |
| **Backend Framework** | **FastAPI (Python 3.11)** | High-performance asynchronous API framework with automatic OpenAPI/Swagger documentation and strong Pydantic validation. |
| **PDF Extraction** | **pdfplumber + pdf2image** | Precise character and layout extraction for digital text-based PDF documents with automatic OCR fallback for scanned PDFs. |
| **Image OCR & Vision** | **pytesseract + OpenCV + Pillow** | Multi-stage image enhancement pipeline (grayscale, Lanczos upscaling, adaptive binarization, deskewing) feeding Tesseract OCR. |
| **AI Summarization** | **Groq API (LLaMA 3.3 70B)** | Ultra-low latency inference delivering structured summaries and bullet points in under two seconds on a free tier. |
| **Deployment** | **Render (Docker) + Vercel** | Containerized backend guaranteeing Tesseract and Poppler system package availability, paired with edge-deployed React static hosting. |

---

## 🏗️ Architecture & Processing Flow

```
[ User Browser ]
       │  (1) Drag & Drop File Upload (PDF / PNG / JPG, <= 10MB)
       ▼
[ React Frontend ] ── (Client Validation: Size & MIME Type)
       │
       │  (2) POST /api/summarize-stream (multipart/form-data with SSE)
       ▼
[ FastAPI Backend ] ── (In-Memory Cache Check & IP Rate Limiting)
       │
       ├─► [ PDF Document ] ────► pdfplumber text extraction (pdf2image fallback)
       │
       └─► [ Scanned Image ] ───► OpenCV Preprocessing (Upscale, Binarize, Deskew) ──► Tesseract OCR
       │
       ▼
[ Extracted Text ] ── (Validate extracted text > 0 words; 422 if unreadable)
       │
       ├─► Heuristic Document Classifier (Academic / Business / Legal / General)
       │
       │  (3) Type-Aware JSON Prompt with Length Preset (Short / Medium / Long)
       ▼
[ Groq AI (LLaMA 3.3 70B Versatile) ]
       │
       │  (4) Structured JSON Response { summary, key_points, document_type }
       ▼
[ React Frontend ] ── (5) Real-Time SSE Updates ➔ Executive Summary Card ➔ Export (.TXT / .MD / Print)
```

1. **Upload & Validate**: Users drag & drop a PDF, PNG, or JPEG file (up to 10MB) and select a summary length (`short`, `medium`, or `long`).
2. **Text Extraction Pipeline**: The backend detects the MIME type. Digital PDFs are parsed directly with `pdfplumber`; scanned images and textless PDFs undergo OpenCV preprocessing before character extraction via `Tesseract OCR`.
3. **Document Classification**: The extracted text is classified into domain archetypes to calibrate the prompt focus.
4. **AI Generation**: Structured prompts are dispatched to Groq's `llama-3.3-70b-versatile` model, returning formatted summary text and key points.
5. **Streaming & Export**: Progress events stream in real-time to the browser, rendering the completed executive brief with one-click export actions (.txt, .md, print).

---

## 💻 Local Setup & Development

### Prerequisites
- **Node.js**: v18+ and `npm`
- **Python**: v3.9+ and `pip`
- **Tesseract OCR Engine & Poppler**:
  - **macOS**: `brew install tesseract poppler`
  - **Ubuntu / Debian**: `sudo apt-get update && sudo apt-get install -y tesseract-ocr tesseract-ocr-eng poppler-utils`
  - **Windows**: Install via UB-Mannheim installer and add to System PATH.

---

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env and insert your GROQ_API_KEY

# Start backend development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
- The backend will be live at `http://localhost:8000`.
- Test health check: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- Interactive API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 2. Frontend Setup

```bash
# In a new terminal tab, navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Configure environment variables
cp .env.example .env
# Local default: VITE_API_URL=http://localhost:8000

# Start frontend development server
npm run dev
```
- Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔐 Environment Variables

### Backend (`/backend/.env`)
| Variable | Description | Where to Get |
|---|---|---|
| `GROQ_API_KEY` | **Required**. API key for Groq LLaMA 3.3 inference. | [console.groq.com/keys](https://console.groq.com/keys) (Free tier available) |
| `ALLOWED_ORIGINS` | *Optional*. Comma-separated list of allowed CORS origins for production. | Your deployed frontend URL (e.g. `https://your-app.vercel.app`) |
| `PORT` | *Optional*. Port for uvicorn (defaults to `8000` or assigned by cloud platform). | Assigned automatically by Render/Cloud Run |

### Frontend (`/frontend/.env`)
| Variable | Description | Where to Get |
|---|---|---|
| `VITE_API_URL` | Base URL of the backend API. Leave empty for proxied dev or set to Render URL in production. | Render Web Service dashboard URL (e.g. `https://your-api.onrender.com`) |

---

## ⚠️ Known Limitations

1. **File Size Limit**: Uploads are restricted to 10 MB to ensure fast server processing and avoid network timeouts on free-tier hosting.
2. **OCR Quality Dependence**: Scanned image extraction accuracy depends on image clarity, lighting, resolution, and contrast. Highly degraded or cursive handwritten scans may result in lower extraction accuracy.
3. **Context Truncation**: Documents exceeding ~25,000 words are safely truncated to fit within LLM prompt limits while preserving the initial and core context.
4. **Cold Starts**: On free hosting tiers (such as Render's free tier), the backend container may spin down during inactivity and take 30–50 seconds on the initial request after idle periods.

---

## 📄 License & Attributions

- **Groq Cloud**: Fast AI inference powered by LLaMA 3.3.
- **Tesseract OCR**: Open-source Optical Character Recognition engine by HP / Google.
- **Render & Vercel**: Hosting and deployment platforms.
