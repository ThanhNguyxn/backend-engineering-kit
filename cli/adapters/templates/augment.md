---
type: always
---

# Backend Kit Rules

> Place at `.augment/rules/backend-kit.md`

This project uses **Backend Engineering Kit (BEK)** - a production-grade knowledge base with patterns and checklists for backend development.

**CLI:** `bek` (npm: production-backend-kit)

## Instructions

### Pattern-Driven Development

When asked to implement backend features:

1. **Search BEK patterns first:**
   ```bash
   bek search "<topic>" --scope <scope>
   ```

2. **Apply the pattern:**
   - Read the **Problem** section to confirm relevance
   - Implement the **Solution** approach
   - Review and avoid **Pitfalls**

3. **Quality gate:**
   ```bash
   bek gate --checklist <checklist-id>
   ```

## Scope Reference

| Domain | Scope | Topics |
|--------|-------|--------|
| API Design | `api` | REST, GraphQL, versioning, pagination, errors |
| Database | `database` | Schema, indexing, migrations, transactions |
| Security | `security` | Auth, secrets, rate limiting, OWASP |
| Reliability | `reliability` | Retries, circuit breakers, timeouts |
| Observability | `observability` | Logging, metrics, tracing, alerting |

## Common Workflows

```bash
# API error handling
bek search "error model" --scope api
bek show api-error-model

# Database optimization
bek search "n+1" --scope database
bek show db-n-plus-1-avoid

# Security hardening
bek search "rate limit" --scope security
bek show sec-rate-limiting
```

## Augment-Specific Tips

- Use `@bek` mentions in chat to reference patterns
- Include pattern IDs in commit messages
- Run `bek doctor` to verify environment setup
- Use `bek init --ai augment` for new projects
