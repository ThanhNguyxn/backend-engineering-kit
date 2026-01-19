---
title: How It Works
description: Architecture and workflow of Backend Engineering Kit
---

# How It Works

Backend Engineering Kit is a CLI-first knowledge base that helps AI coding assistants and developers follow production-grade patterns.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Backend Engineering Kit                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Patterns   │  │  Checklists  │  │  Templates   │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                 │                   │
│         └────────┬────────┴────────┬────────┘                   │
│                  │                 │                            │
│         ┌────────▼─────────────────▼────────┐                   │
│         │           Knowledge DB            │                   │
│         │     (SQLite FTS + Embeddings)     │                   │
│         └────────────────┬──────────────────┘                   │
│                          │                                      │
│         ┌────────────────▼──────────────────┐                   │
│         │            BEK CLI                │                   │
│         │  search | list | gate | init      │                   │
│         └────────────────┬──────────────────┘                   │
│                          │                                      │
├──────────────────────────┼──────────────────────────────────────┤
│                          │                                      │
│  ┌───────────┐  ┌────────▼──────┐  ┌───────────┐                │
│  │  Claude   │  │   Copilot     │  │  Cursor   │  AI Adapters   │
│  │  CLAUDE.md│  │  .github/...  │  │.cursorrules                │
│  └───────────┘  └───────────────┘  └───────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Patterns

Production-grade solutions for common backend problems.

| Scope | Examples |
|-------|----------|
| API | Error model, Pagination, Idempotency |
| Database | Indexing, Migrations, N+1 avoidance |
| Security | Rate limiting, Secrets, AuthN/AuthZ |
| Reliability | Circuit breaker, Retries, Timeouts |
| Observability | Structured logging, Metrics, Tracing |

Each pattern includes:
- **Problem** - What issue it solves
- **When to use** - Context and conditions
- **Solution** - Step-by-step implementation
- **Pitfalls** - Common mistakes
- **Checklist** - Verification items

### 2. Checklists

Quality gates for code reviews and deployments.

| Checklist | Purpose |
|-----------|---------|
| API Review | REST endpoint best practices |
| Database Review | Schema and query validation |
| Security Review | Security controls verification |
| Reliability Review | Resilience pattern checks |
| Production Readiness | Pre-deployment validation |

### 3. Templates

Project scaffolding with best practices built-in.

| Template | Stack | Features |
|----------|-------|----------|
| node-minimal | Node.js + TypeScript | ESM, tsx |
| node-standard | Fastify + Docker | CI, OpenAPI, Logging |
| python-fastapi | FastAPI + Pydantic | uvicorn, Docker |
| go-minimal | Go stdlib | Minimal HTTP server |

Run `bek templates list` to see all available templates.

### 4. AI Adapters

Configuration files for AI coding assistants.

**IDE/Editor Adapters:**

| Adapter | File | Description |
|---------|------|-------------|
| Cursor | `.cursorrules` | Cursor IDE |
| Windsurf | `.windsurfrules` | Codeium Windsurf IDE |
| Zed | `.zed/instructions.md` | Zed editor |

**Extension Adapters:**

| Adapter | File | Description |
|---------|------|-------------|
| Copilot | `.github/copilot-instructions.md` | GitHub Copilot |
| Cline | `.clinerules` | Cline VS Code (autonomous) |
| Continue | `.continue/config.json` | Continue VS Code/JetBrains |
| Cody | `.cody/instructions.md` | Sourcegraph Cody |
| Tabnine | `.tabnine/instructions.md` | Tabnine autocomplete |
| Codeium | `.codeium/instructions.md` | Codeium autocomplete |

**CLI/Terminal Adapters:**

| Adapter | File | Description |
|---------|------|-------------|
| Claude | `CLAUDE.md` | Anthropic Claude Code |
| Codex | `AGENTS.md` | OpenAI Codex |
| OpenCode | `AGENTS.md` | OpenCode terminal AI |
| Goose | `.goose/instructions.md` | Block's Goose agent |
| Gemini | `.gemini/context.md` | Google Gemini CLI |
| Amazon Q | `.amazonq/instructions.md` | Amazon Q Developer |
| Aider | `.aider.conf.yml` | Aider CLI (open source) |

Run `bek init --ai <adapter>` to add adapter configuration to your project.
Run `bek templates list --type adapter` to see all available adapters.

## Workflow

```
Developer Request
       │
       ▼
┌──────────────┐
│ 1. PARSE     │  Identify task type and scope
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 2. SEARCH    │  bek search "error handling" --scope api
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 3. APPLY     │  Follow pattern's Solution section
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 4. VALIDATE  │  bek gate --checklist checklist-api-review
└──────────────┘
```

## CLI Commands

```bash
# Initialize project with patterns
bek init --ai claude,copilot

# Search patterns
bek search "authentication" --scope security

# Run quality gate
bek gate --checklist checklist-api-review

# List all templates
bek templates list --all

# Validate templates
bek templates validate --json

# Lint content
bek lint --fix
```

## File Structure

```
backend-engineering-kit/
├── .shared/production-backend-kit/
│   ├── patterns/           # Pattern files
│   ├── checklists/         # Checklist files
│   └── knowledge-registry.yaml
├── templates/
│   ├── registry.yaml       # Template registry
│   ├── schema/             # JSON Schema validation
│   └── projects/           # Template skeletons
├── adapters/
│   ├── templates/          # AI adapter templates
│   └── {claude,copilot,cursor,codex}/
├── cli/                    # BEK CLI source
└── docs-site/              # This documentation
```

## Integration with AI Assistants

1. **Install BEK CLI:**
   ```bash
   npm i -g production-backend-kit
   ```

2. **Initialize project:**
   ```bash
   bek init --ai claude
   ```

3. **AI follows workflow:**
   - Searches patterns for relevant solutions
   - Applies pattern's Solution section
   - Validates with quality gate checklist

4. **Result:** Production-grade code following best practices
