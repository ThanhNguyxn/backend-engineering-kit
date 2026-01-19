---
title: Template Gallery
description: Browse all available project templates
---

# Template Gallery

Backend Engineering Kit provides production-grade project templates for various stacks and use cases.

## Available Templates

<div class="template-card">

### 🟢 Node.js Minimal

**Stack:** Node.js + TypeScript  
**Level:** Minimal

Bare minimum Node.js starter with TypeScript and ESM. Perfect for learning or building something from scratch.

**Features:**
- TypeScript with strict mode
- ESM modules
- tsx for development

[View Template →](/backend-engineering-kit/templates/node-minimal)

<div class="template-tags">
  <span class="template-tag node">node</span>
  <span class="template-tag">typescript</span>
  <span class="template-tag">esm</span>
</div>

</div>

<div class="template-card">

### 🟢 Node.js Standard

**Stack:** Node.js + Fastify  
**Level:** Standard

Production-ready Node.js with Fastify, structured logging, OpenAPI, Docker, and CI. Best for real-world APIs.

**Features:**
- Fastify web framework
- Pino structured logging
- Zod schema validation
- Swagger/OpenAPI docs
- Docker multi-stage build
- GitHub Actions CI

[View Template →](/backend-engineering-kit/templates/node-standard)

<div class="template-tags">
  <span class="template-tag node">node</span>
  <span class="template-tag">fastify</span>
  <span class="template-tag">docker</span>
  <span class="template-tag">openapi</span>
  <span class="template-tag">ci</span>
</div>

</div>

<div class="template-card">

### 🔵 Python FastAPI

**Stack:** Python + FastAPI  
**Level:** Standard

Production-ready FastAPI with Pydantic, async support, and Docker. Perfect for Python microservices.

**Features:**
- FastAPI async framework
- Pydantic v2 validation
- Pydantic Settings for config
- uvicorn ASGI server
- Health/readiness endpoints

[View Template →](/backend-engineering-kit/templates/python-fastapi)

<div class="template-tags">
  <span class="template-tag python">python</span>
  <span class="template-tag">fastapi</span>
  <span class="template-tag">pydantic</span>
  <span class="template-tag">docker</span>
</div>

</div>

<div class="template-card">

### 🩵 Go Minimal

**Stack:** Go  
**Level:** Minimal

Minimal Go HTTP server using only the standard library. No dependencies, fast compile times.

**Features:**
- Standard library only
- JSON health endpoint
- Environment-based port
- Go modules

[View Template →](/backend-engineering-kit/templates/go-minimal)

<div class="template-tags">
  <span class="template-tag go">go</span>
  <span class="template-tag">stdlib</span>
</div>

</div>

## Quick Start

```bash
# List all templates
bek templates list

# Filter by stack
bek templates list --stack node

# Create a new project
bek init node-standard --name my-api
```

## Coming Soon

- **rust-axum** - Rust with Axum web framework
- **node-advanced** - Enterprise Node.js with auth, observability
- **python-django** - Django REST framework
