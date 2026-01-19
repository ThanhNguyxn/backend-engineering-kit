---
title: Python FastAPI
description: Production-ready Python FastAPI with Pydantic and Docker
---

# Python FastAPI Template

Production-ready FastAPI with Pydantic validation, async support, and Docker.

## Overview

| Property | Value |
|----------|-------|
| **ID** | `python-fastapi` |
| **Stack** | Python |
| **Level** | Standard |
| **Tags** | fastapi, pydantic, docker, openapi, uvicorn |

## Prerequisites

- Python >= 3.11
- pip or uv
- Docker (optional)

## Quick Start

```bash
# Create a new project
bek init python-fastapi --name my-api

# Navigate and create virtual environment
cd my-api
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Install dependencies
pip install -e ".[dev]"

# Start development
python -m app.main
# or
uvicorn app.main:app --reload

# Server runs at http://localhost:8000
# API docs at http://localhost:8000/docs
```

## Project Structure

```
my-api/
├── pyproject.toml
└── app/
    ├── __init__.py
    ├── main.py           # FastAPI application
    ├── config.py         # Pydantic Settings
    └── routes/
        └── health.py     # Health check endpoints
```

## Features

### FastAPI Framework

Modern, fast web framework with automatic OpenAPI generation.

```python
from fastapi import FastAPI

app = FastAPI(
    title="My API",
    description="My awesome API",
    version="0.1.0",
)

@app.get("/")
async def root():
    return {"message": "Hello World"}
```

### Pydantic Settings

Type-safe configuration from environment variables.

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "my-api"
    port: int = 8000
    debug: bool = False
    database_url: str | None = None

settings = Settings()
```

### Pydantic Models

Automatic validation and serialization.

```python
from pydantic import BaseModel
from datetime import datetime

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    version: str
```

### CORS Middleware

Configured for cross-origin requests.

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Lifespan Events

Clean startup and shutdown handling.

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting up...")
    yield
    # Shutdown
    print("Shutting down...")
```

## Scripts

```bash
# Development
uvicorn app.main:app --reload

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Testing
pytest

# Linting
ruff check .
ruff format .
```

## Health Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Full health check |
| `GET /api/ready` | Readiness probe |
| `GET /api/live` | Liveness probe |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG` | `false` | Enable debug mode |
| `PORT` | `8000` | Server port |
| `DATABASE_URL` | `None` | Database connection string |
