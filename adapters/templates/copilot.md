# GitHub Copilot Instructions

> For `.github/copilot-instructions.md`

## Project Context

This project uses **Backend Engineering Kit (BEK)** - a production-grade knowledge base with patterns, checklists, and templates for backend development.

**CLI Tool:** `bek` (npm: production-backend-kit)

## Tech Stack

<!-- Update this section for your project -->
- **Runtime:** Node.js 22+
- **Language:** TypeScript (strict mode)
- **Framework:** Fastify / Express
- **Database:** PostgreSQL
- **Testing:** Vitest

## Coding Guidelines

### Before Implementing Backend Features

1. Search for relevant patterns:
   ```bash
   bek search "<feature keywords>"
   ```

2. Read the matched pattern's sections:
   - **Solution** - Follow this structure
   - **Pitfalls** - Avoid these mistakes
   - **Checklist** - Complete all items

### Pattern Search Examples

| Task | Command |
|------|---------|
| Error handling | `bek search "error handling" --scope api` |
| Database indexes | `bek search "indexing" --scope database` |
| Authentication | `bek search "authentication" --scope security` |
| Rate limiting | `bek search "rate limiting" --scope reliability` |
| Structured logging | `bek search "logging" --scope observability` |

### After Implementation

Run quality gate to validate:
```bash
bek gate --checklist <checklist-id>
```

## Available Checklists

| ID | When to Use |
|----|-------------|
| `checklist-api-review` | New REST endpoints |
| `checklist-db-review` | Database changes |
| `checklist-security-review` | Auth/security features |
| `checklist-reliability-review` | Error handling, retries |
| `checklist-prod-readiness` | Before deployment |

## Scope Reference

| Scope | Applies To |
|-------|------------|
| `api` | REST, GraphQL, endpoints |
| `database` | SQL, ORM, migrations |
| `security` | Auth, secrets, OWASP |
| `reliability` | Timeouts, retries, circuit breakers |
| `observability` | Logging, metrics, tracing |

## Project Structure

```
src/
├── index.ts          # Entry point
├── config.ts         # Environment configuration
├── routes/           # API route handlers
├── services/         # Business logic
├── db/               # Database models/queries
└── lib/              # Shared utilities
```

## Code Style

- Use ES modules (`import`/`export`)
- Prefer `async/await` over callbacks
- Use Zod for runtime validation
- Structured logging with Pino
- Handle errors explicitly
