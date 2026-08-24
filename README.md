# Document Summary Assistant

> An intelligent, full-stack web application that extracts text from PDFs and scanned images via native document parsing and Tesseract OCR, generating executive summaries and numbered key takeaways using Groq's high-speed LLaMA 3.3 LLM.

---

## 🌐 Live URLs

- **Live Application (Frontend)**: `https://your-app-name.vercel.app` *(Replace with your Vercel deployment URL)*
- **API Health Check (Backend)**: `https://your-api-name.onrender.com/api/health` *(Replace with your Render deployment URL)*
- **API Interactive Docs (Swagger)**: `https://your-api-name.onrender.com/docs`

---

## 📸 Application Preview

<!-- Add your application screenshot or demo GIF here -->
```markdown
![Document Summary Assistant Screenshot](./docs/screenshot.png)
```
> *Tip: To add a preview image, place a screenshot or GIF in a `docs/` folder or drag it directly into a GitHub issue/release to generate a permanent CDN link, then update the image tag above.*

---

## 🛠️ Tech Stack & Justifications

| Layer | Technology | Justification |
|---|---|---|
| **Frontend Framework** | **React 18 (Vite)** | Lightning-fast development builds, responsive component architecture, and lightweight client bundling. |
| **Styling** | **Tailwind CSS** | Utility-first styling enabling a clean, accessible layout with WCAG-compliant color contrast and mobile responsiveness. |
| **Drag & Drop** | **react-dropzone** | Accessible, intuitive file dropzone with instantaneous client-side validation for file size and MIME types. |
| **Icons** | **Lucide React** | Crisp, lightweight, tree-shakeable SVG icons for document types, loaders, and status alerts. |
| **Backend Framework** | **FastAPI (Python 3.11)** | High-performance asynchronous API framework with automatic OpenAPI/Swagger documentation and strong Pydantic validation. |
| **PDF Extraction** | **pdfplumber** | Precise character and layout extraction for digital text-based PDF documents without heavy overhead. |
| **Image OCR** | **pytesseract + Pillow** | Industry-standard optical character recognition with grayscale image preprocessing for scanned documents and screenshots. |
| **AI Summarization** | **Groq API (LLaMA 3.3 70B)** | Ultra-low latency inference delivering structured summaries and bullet points in under two seconds on a free tier. |
| **Deployment** | **Render (Docker) + Vercel** | Containerized backend guaranteeing Tesseract system package availability, paired with edge-deployed React static hosting. |

---

## 🏗️ Architecture & Processing Flow

```
[ User Browser ]
       │  (1) Drag & Drop File Upload (PDF / PNG / JPG, <= 10MB)
       ▼
[ React Frontend ] ── (Client Validation: Size & MIME Type)
       │
       │  (2) POST /api/summarize (multipart/form-data)
       ▼
[ FastAPI Backend ]
       │
       ├─► [ PDF Document ] ────► pdfplumber text extraction
       │
       └─► [ Scanned Image ] ───► Pillow Grayscale Preprocessing ──► Tesseract OCR
       │
       ▼
[ Extracted Text ] ── (Validate extracted text > 0 words; 422 if unreadable)
       │
       │  (3) JSON Prompt with Length Preset (Short / Medium / Long)
       ▼
[ Groq AI (LLaMA 3.3 70B Versatile) ]
       │
       │  (4) Structured JSON Response { summary, key_points }
       ▼
[ React Frontend ] ── (5) Interactive Executive Summary + Bulleted Takeaways + Copy Action
```

1. **Upload & Validate**: Users drag & drop a PDF, PNG, or JPEG file (up to 10MB) and select a summary length (`short`, `medium`, or `long`).
2. **Text Extraction Pipeline**: The backend detects the MIME type. Digital PDFs are parsed directly with `pdfplumber`; image scans are preprocessed with PIL and extracted via `Tesseract OCR`.
3. **Empty Text Guard**: If no readable text is detected, the API immediately halts with `422 Unprocessable Entity` and displays guidance.
4. **AI Generation**: Valid text is formatted and sent to Groq's `llama-3.3-70b-versatile` model, returning a structured summary paragraph and key bullet points.
5. **Display & Action**: The UI renders a formatted summary card with word counts, copy-to-clipboard actions, and a one-click reset flow.

---

## 💻 Local Setup & Development

### Prerequisites
- **Node.js**: v18+ and `npm`
- **Python**: v3.9+ and `pip`
- **Tesseract OCR Engine**:
  - **macOS**: `brew install tesseract`
  - **Ubuntu / Debian**: `sudo apt-get update && sudo apt-get install -y tesseract-ocr tesseract-ocr-eng`
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
