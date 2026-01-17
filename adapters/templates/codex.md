# Codex / OpenAI Agent Instructions

> For AGENTS.md or codex configuration

## Knowledge Base

This project has **Backend Engineering Kit (BEK)** with:
- 25+ production patterns
- 5 quality checklists
- Project templates

**CLI:** `bek` (npm: production-backend-kit)

## Available Commands

| Command | Purpose |
|---------|---------|
| `bek search "<query>"` | Find relevant patterns |
| `bek search "<query>" --scope <scope>` | Filter by scope |
| `bek gate --checklist <id>` | Run quality checklist |
| `bek list --type pattern` | List all patterns |
| `bek list --type checklist` | List all checklists |
| `bek templates list` | List project templates |

## Scopes

| Scope | For |
|-------|-----|
| `api` | REST, GraphQL, endpoints |
| `database` | SQL, ORM, migrations |
| `security` | Auth, secrets |
| `reliability` | Retries, timeouts |
| `observability` | Logging, metrics |

## Checklists

| ID | Purpose |
|----|---------|
| `checklist-api-review` | API best practices |
| `checklist-db-review` | Database review |
| `checklist-security-review` | Security controls |
| `checklist-reliability-review` | Reliability patterns |
| `checklist-prod-readiness` | Deployment check |

## Workflow

1. **Search** patterns related to the task
2. **Apply** the Solution from matched pattern
3. **Avoid** the listed Pitfalls
4. **Validate** with appropriate checklist

## Example

```bash
# Find error handling patterns
bek search "error handling" --scope api

# Validate API implementation
bek gate --checklist checklist-api-review
```
