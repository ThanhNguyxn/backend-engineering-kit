---
title: Introduction
description: Learn about Backend Engineering Kit and its features
---

# Backend Engineering Kit

**Production-grade patterns, templates, and tools for backend development.**

Backend Engineering Kit (BEK) is a CLI tool and knowledge base designed to help you build production-ready backend services faster and with fewer mistakes.

## What's Included

### 📚 Pattern Library
25+ battle-tested patterns covering:
- API Design (REST, GraphQL, gRPC)
- Database Operations (PostgreSQL, MongoDB, Redis)
- Security (Authentication, Authorization, Secrets)
- Reliability (Circuit Breakers, Retries, Health Checks)
- Observability (Logging, Metrics, Tracing)

### ✅ Production Checklists
5 comprehensive checklists to ensure your service is production-ready:
- API Review Checklist
- Database Review Checklist
- Security Review Checklist
- Reliability Review Checklist
- Production Readiness Checklist

### 🚀 Project Templates
4 production-grade templates to bootstrap your projects:
- **node-minimal** - TypeScript, ESM, minimal starter
- **node-standard** - Fastify, Pino, Zod, Docker, CI
- **python-fastapi** - FastAPI, Pydantic, uvicorn
- **go-minimal** - Standard library HTTP server

### 🤖 AI Adapter Templates
Pre-configured prompts for AI coding assistants:
- GitHub Copilot
- Cursor
- Claude
- OpenAI Codex

## Quick Start

```bash
# Install globally
npm install -g production-backend-kit

# Check installation
bek doctor

# Create a new project
bek init node-standard --name my-api

# Search patterns
bek search "error handling"

# Run production checklist
bek gate --checklist checklist-prod-readiness
```

## Next Steps

- [Installation Guide](/backend-engineering-kit/guides/installation) - Set up BEK on your machine
- [Quick Start](/backend-engineering-kit/guides/quickstart) - Create your first project
- [Template Gallery](/backend-engineering-kit/templates/gallery) - Explore available templates
