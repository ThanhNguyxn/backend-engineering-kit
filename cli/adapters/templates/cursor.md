# Cursor Rules for Backend Kit

> Place in `.cursor/rules/backend-kit.mdc` or root `.cursorrules`

## Context

You have access to **Backend Engineering Kit (BEK)** via CLI. Use it to find patterns and validate implementations.

**CLI:** `bek` (npm: production-backend-kit)

## Rules

### Before Implementing Backend Features

1. **Search for patterns:**
   ```bash
   bek search "<feature>" --scope <scope>
   ```

2. **Read the matched pattern:**
   - Follow the **Solution** section
   - Avoid the **Pitfalls**
   - Complete the **Checklist** items

3. **After implementation:**
   ```bash
   bek gate --checklist <id>
   ```

## Scope Mapping

| Task Type | Scope Flag |
|-----------|------------|
| REST/GraphQL APIs | `--scope api` |
| SQL/ORM/Migrations | `--scope database` |
| Auth/Secrets/OWASP | `--scope security` |
| Timeouts/Retries/Circuit Breakers | `--scope reliability` |
| Logging/Metrics/Tracing | `--scope observability` |

## Search Examples

```bash
# Error handling
bek search "error handling" --scope api

# Database indexing
bek search "indexing" --scope database

# Authentication
bek search "authentication" --scope security

# Rate limiting
bek search "rate limiting" --scope reliability

# Structured logging
bek search "logging" --scope observability
```

## Available Checklists

| ID | Use When |
|----|----------|
| `checklist-api-review` | Adding REST endpoints |
| `checklist-db-review` | Database schema changes |
| `checklist-security-review` | Auth/security features |
| `checklist-reliability-review` | Error handling, retries |
| `checklist-prod-readiness` | Before deployment |

## Project Templates

```bash
# List templates
bek templates list --stack node

# Scaffold new project
bek init node-standard --name my-api
```

## Code Generation Guidelines

When generating code:
1. Search patterns first
2. Follow pattern structure
3. Include error handling
4. Add appropriate logging
5. Consider security implications
