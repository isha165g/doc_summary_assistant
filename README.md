# Document Summary Assistant

> A full-stack application for uploading documents (PDFs and images), extracting text via parsing/OCR, and generating AI summaries.

*Note: This repository currently contains **Phase 1 of 6** — skeleton scaffolding only (no document extraction or AI summarization logic yet).*

---

## Project Structure

```
├── backend/
│   ├── main.py              # FastAPI application with /api/health and CORS
│   ├── requirements.txt     # Python dependencies (fastapi, uvicorn, python-multipart)
│   ├── routes/              # Modular route handlers (ready for Phase 2+)
│   └── services/            # Document and summarization services (ready for Phase 2+)
├── frontend/
│   ├── index.html           # HTML entry point
│   ├── package.json         # Node.js dependencies and scripts
│   ├── vite.config.js       # Vite configuration
│   ├── tailwind.config.js   # Tailwind CSS configuration
│   ├── postcss.config.js    # PostCSS configuration
│   ├── .env.example         # Environment variables template (VITE_API_URL)
│   └── src/
│       ├── main.jsx         # React entry point
│       ├── App.jsx          # Phase 1 UI (file input + backend health check)
│       ├── index.css        # Tailwind styles
│       └── components/      # Component directory (ready for future phases)
└── README.md                # Project documentation
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
   The backend API will be running at `http://localhost:8000`. You can verify by visiting:
   - Health endpoint: [http://localhost:8000/api/health](http://localhost:8000/api/health)
   - Interactive docs: [http://localhost:8000/docs](http://localhost:8000/docs)

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
   The frontend application will be running at [http://localhost:5173](http://localhost:5173).

---

## Connectivity & Verification

1. Start both servers (`uvicorn main:app --reload` on port 8000, `npm run dev` on port 5173).
2. Open [http://localhost:5173](http://localhost:5173) in your browser.
3. Click the **"Check backend"** button.
4. The page will display **"Backend status: ok"** confirming successful cross-origin communication between the Vite frontend and FastAPI backend without CORS errors.
