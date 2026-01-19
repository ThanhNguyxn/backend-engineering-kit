---
title: Quick Start
description: Create your first project with Backend Engineering Kit
---

# Quick Start

This guide will walk you through creating your first project using Backend Engineering Kit.

## Create a New Project

### 1. Initialize with a Template

```bash
# Interactive mode - select from available templates
bek init

# Or specify a template directly
bek init node-standard --name my-api
```

### 2. Navigate and Install

```bash
cd my-api
npm install
```

### 3. Start Development

```bash
npm run dev
```

Your server will be running at `http://localhost:3000`.

## Explore Patterns

Search the pattern library for best practices:

```bash
# Search by keyword
bek search "error handling"

# Search with filters
bek search "authentication" --stack nodejs --level intermediate

# List all patterns
bek list --type pattern
```

## View a Pattern

```bash
bek show pattern-error-handling
```

This displays:
- Problem statement
- Recommended solution
- Common pitfalls
- Implementation checklist

## Run a Quality Gate

Before deploying, run production checklists:

```bash
# API review
bek gate --checklist checklist-api-review

# Full production readiness
bek gate --checklist checklist-prod-readiness
```

## Template Options

| Template | Stack | Features |
|----------|-------|----------|
| `node-minimal` | Node.js + TypeScript | Minimal starter, ESM |
| `node-standard` | Node.js + Fastify | Docker, CI, OpenAPI, Logging |
| `python-fastapi` | Python + FastAPI | Pydantic, Docker, uvicorn |
| `go-minimal` | Go | Standard library HTTP |

## Next Steps

- [Template Gallery](/backend-engineering-kit/templates/gallery) - Explore all templates
- [CLI Reference](/backend-engineering-kit/cli/commands) - Full command documentation
