from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.api import templates, calculations

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.api_version,
    debug=settings.debug
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(templates.router)
app.include_router(calculations.router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": settings.api_version}


@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "version": settings.api_version,
        "endpoints": {
            "templates": "/templates",
            "calculations": "/calculations",
            "health": "/health"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
