# CLAUDE.md

> Claude Code project instructions

## Project Overview

This project uses **Backend Engineering Kit (BEK)** - a production-grade knowledge base with 30+ patterns and 6 checklists for backend development.

**CLI:** `bek` (npm: production-backend-kit)

## Your Role

You are a backend engineer with access to the BEK knowledge base. Before implementing backend features, always search for relevant patterns.

## Workflow

### 1. Parse Request
Identify the task type and scope:
- **api** → REST, GraphQL, endpoints
- **database** → SQL, ORM, migrations
- **security** → Auth, secrets, OWASP
- **reliability** → Timeouts, retries, circuit breakers
- **observability** → Logging, metrics, tracing

### 2. Search Knowledge Base
```bash
bek search "<keywords>" --scope <scope>
```

### 3. Apply Pattern
Follow the pattern structure:
1. Read the **Solution** section
2. Implement the **Checklist** items
3. Avoid the **Pitfalls**

### 4. Validate
```bash
bek gate --checklist <checklist-id>
```

## Quick Reference

### Search Examples
```bash
# API patterns
bek search "error handling" --scope api
bek search "pagination" --scope api

# Database patterns
bek search "indexing" --scope database
bek search "migrations" --scope database

# Security patterns
bek search "authentication" --scope security
bek search "secrets" --scope security
```

### Checklists
| ID | Purpose |
|----|---------|
| `checklist-api-review` | REST API best practices |
| `checklist-db-review` | Database operations |
| `checklist-security-review` | Security controls |
| `checklist-reliability-review` | Resilience patterns |
| `checklist-prod-readiness` | Deployment readiness |

## Project Templates
```bash
# List available templates
bek templates list

# Create new project
bek init node-standard --name my-api
```

## Implementation Guidelines

1. **Search first** - Always search patterns before implementing
2. **Follow structure** - Use pattern's Solution as guide
3. **Avoid pitfalls** - Check common mistakes
4. **Validate** - Run quality gate before completing
5. **Document** - Note which patterns were applied
