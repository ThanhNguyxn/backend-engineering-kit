# Cursor Rules for Backend Kit

## Context
You have access to the Production Backend Kit via CLI commands.

## Rules

### Before Implementing Backend Features
1. Search for relevant patterns: `kit search "<feature>" --scope <scope>`
2. Read the matched pattern's Solution section
3. Follow the Checklist items

### After Implementation
1. Run quality gate: `kit gate --checklist <id>`
2. Ensure all checklist items pass

### Pattern Search Examples
- API endpoint: `kit search "error handling" --scope api`
- Database: `kit search "indexing" --scope database`
- Security: `kit search "authentication" --scope security`

### Scope Mapping
- REST/GraphQL APIs → `--scope api`
- SQL/ORM/Migrations → `--scope database`
- Auth/Secrets/OWASP → `--scope security`
- Timeouts/Retries/Circuit Breakers → `--scope reliability`
- Logging/Metrics/Tracing → `--scope observability`
