# AGENTS.md

> Place at `.devin/AGENTS.md` - Devin AI will auto-discover this file

## Project Overview

This project uses **Backend Engineering Kit (BEK)** for production backend patterns.

## Setup Commands

```bash
# Install BEK CLI
npm install -g production-backend-kit

# Verify installation
bek doctor

# List available patterns
bek list
```

## Development Workflow

Before implementing any backend feature:

1. **Search for relevant patterns:**
   ```bash
   bek search "<feature topic>" --scope <scope>
   ```

2. **Review pattern details:**
   ```bash
   bek show <pattern-id>
   ```

3. **Follow pattern guidance:**
   - Use recommended structure from **Solution** section
   - Avoid documented **Pitfalls**
   - Include error handling, logging, and metrics

4. **Validate implementation:**
   ```bash
   bek gate --checklist <checklist-id>
   ```

## Code Style

- Follow pattern recommendations for error handling
- Use structured logging (JSON format)
- Include correlation IDs for tracing
- Implement proper input validation
- Add health check endpoints

## Testing Guidelines

- Write unit tests for all business logic
- Cover error scenarios from pattern Pitfalls section
- Test edge cases documented in checklists

## Available Scopes

| Scope | Topics |
|-------|--------|
| `api` | REST, GraphQL, versioning, pagination, errors |
| `database` | Schema, indexing, migrations, transactions |
| `security` | Auth, secrets, rate limiting, OWASP |
| `reliability` | Retries, circuit breakers, timeouts |
| `observability` | Logging, metrics, tracing, alerting |

## Quick Commands

```bash
# Search patterns
bek search "error handling"

# Show pattern
bek show api-error-model

# Run quality gate
bek gate --checklist checklist-api-review

# Validate configuration
bek validate
```
