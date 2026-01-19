# Replit AI Rules for Backend Kit

> Add to Replit AI assistant configuration or .replit file

## Context

This project uses **Backend Engineering Kit (BEK)** for production-ready backend development patterns.

**CLI:** `bek` (npm: production-backend-kit)

## Setup in Replit

```bash
# Install BEK
npm install -g production-backend-kit

# Initialize project
bek init --ai replit --preset node-fastify
```

## AI Assistant Instructions

When building backend features in Replit:

### 1. Pattern Lookup

```bash
# Search for patterns
bek search "<feature>"

# Example searches
bek search "authentication"
bek search "database connection pool"
bek search "error handling"
```

### 2. Apply Patterns

```bash
# View full pattern
bek show <pattern-id>

# List all patterns
bek list
```

### 3. Quality Validation

```bash
# Run checklist
bek gate --checklist <id>

# Available checklists
bek list --domain checklist
```

## Scope Mapping

| Replit Template | BEK Scope | Suggested Patterns |
|-----------------|-----------|-------------------|
| Node.js | `api`, `reliability` | api-error-model, rel-retries-backoff |
| Python Flask/FastAPI | `api`, `security` | api-request-validation, sec-rate-limiting |
| PostgreSQL | `database` | db-connection-pooling, db-migrations-strategy |
| Redis | `database` | rel-caching-strategies |

## Replit-Specific Workflows

```bash
# For web services
bek search "health check" --scope reliability
bek show rel-health-checks

# For databases
bek search "connection" --scope database
bek show db-connection-pooling

# For APIs
bek search "validation" --scope api
bek show api-request-validation
```

## Environment Variables

BEK patterns include guidance on secrets management:

```bash
bek show sec-secrets-management
```

Never hardcode secrets - use Replit Secrets.
