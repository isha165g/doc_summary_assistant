import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.summarize import router as summarize_router

# Initialize FastAPI application
app = FastAPI(
    title="Document Summary Assistant API",
    description="Backend API for Document Summary Assistant with OCR and AI Summarization",
    version="1.0.0",
)

# CORS configuration: Allow localhost development and configurable production origins
default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Read optional comma-separated ALLOWED_ORIGINS from environment (e.g. from Vercel deployment)
custom_origins_env = os.getenv("ALLOWED_ORIGINS", "").strip()
custom_origins = [origin.strip() for origin in custom_origins_env.split(",") if origin.strip()]

allowed_origins = list(set(default_origins + custom_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_origin_regex=r"https://.*\.vercel\.app" if not custom_origins else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(summarize_router)


@app.get("/api/health")
async def health_check():
    """
    Health check endpoint returning the status of the service.
    """
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

