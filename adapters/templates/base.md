# Backend Engineering Kit - AI Adapter Base Template

> **Version:** 2.0  
> **CLI:** `bek` (production-backend-kit)  
> **Updated:** 2026-01

## Overview

This project uses **Backend Engineering Kit (BEK)** - a production-grade knowledge base with 25+ patterns and 5 checklists for backend development.

## Core Workflow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   PARSE     │ →  │   SEARCH    │ →  │   APPLY     │ →  │   VALIDATE  │
│   Request   │    │   Pattern   │    │   Pattern   │    │   Quality   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 1. Parse Request
- Identify task type: API, database, security, reliability, observability
- Extract technology stack from context
- Determine scope for pattern search

### 2. Search Knowledge Base
```bash
bek search "<keywords>" --scope <scope> --works-with <stack>
```

### 3. Apply Pattern
- Follow the **Solution** section structure
- Implement all items from the **Checklist**
- Avoid the listed **Pitfalls**

### 4. Validate Quality
```bash
bek gate --checklist <checklist-id>
```

---

## CLI Reference

### Search Patterns
```bash
# Basic search
bek search "error handling"

# Filtered search
bek search "authentication" --scope security --works-with nodejs

# List all patterns
bek list --type pattern
```

### Quality Gates
```bash
# Run specific checklist
bek gate --checklist checklist-api-review

# Available checklists
bek list --type checklist
```

### Template Scaffolding
```bash
# List project templates
bek templates list

# Create new project
bek init node-standard --name my-api
```

---

## Scopes

| Scope | Use For |
|-------|---------|
| `api` | REST, GraphQL, gRPC endpoints |
| `database` | SQL, ORM, migrations, queries |
| `security` | Auth, secrets, OWASP, encryption |
| `reliability` | Timeouts, retries, circuit breakers |
| `observability` | Logging, metrics, tracing |

---

## Checklists

| ID | Purpose |
|----|---------|
| `checklist-api-review` | REST API best practices |
| `checklist-db-review` | Database schema, queries, migrations |
| `checklist-security-review` | Security controls |
| `checklist-reliability-review` | Resilience patterns |
| `checklist-prod-readiness` | Pre-deployment verification |

---

## Pattern Structure

Each pattern contains:

1. **Problem** - What issue we're solving
2. **Context** - When this pattern applies
3. **Solution** - Step-by-step implementation
4. **Pitfalls** - Common mistakes to avoid
5. **Checklist** - Verification items

---

## Implementation Guidelines

When generating backend code:

1. **Always search first** - Find relevant patterns before implementing
2. **Follow the structure** - Use pattern's Solution section as guide
3. **Check pitfalls** - Review and avoid listed mistakes
4. **Validate thoroughly** - Run appropriate quality gate checklist
5. **Document decisions** - Note which patterns were applied
