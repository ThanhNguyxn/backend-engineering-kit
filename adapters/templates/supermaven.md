# Supermaven Rules for Backend Kit

> Add to Supermaven configuration or system prompt

## Context

This project uses **Backend Engineering Kit (BEK)** for production-ready backend patterns.

**CLI:** `bek` (npm: production-backend-kit)

## Autocomplete Enhancement

When Supermaven suggests code for backend features, enhance with BEK patterns:

### Before Accepting Suggestions

1. **Verify against patterns:**
   ```bash
   bek search "<feature>" --scope <scope>
   ```

2. **Check for pitfalls:**
   - Read the pattern's **Pitfalls** section
   - Ensure suggestion avoids common mistakes

### Scopes

- `api` - REST, GraphQL, error handling
- `database` - SQL, ORM, migrations
- `security` - Auth, secrets, rate limiting
- `reliability` - Retries, circuit breakers
- `observability` - Logging, metrics, tracing

## Quick Reference

```bash
# Find relevant patterns
bek list --domain api
bek list --domain database

# Get pattern details
bek show <pattern-id>

# Validate implementation
bek gate --checklist checklist-api-review
```

## Integration Tips

1. **Comment patterns in code:**
   ```typescript
   // Pattern: api-error-model
   // See: bek show api-error-model
   ```

2. **Use BEK search in prompts:**
   "Implement retry logic following `bek show rel-retries-backoff`"

3. **Run quality gates:**
   ```bash
   bek gate --checklist checklist-prod-readiness
   ```
