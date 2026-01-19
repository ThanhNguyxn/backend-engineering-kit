# GitHub Copilot Instructions

This project uses **Backend Engineering Kit (BEK)** - production-grade patterns for backend development.

## CLI Commands

```bash
bek search "error handling"    # Find patterns
bek show api-error-model       # View pattern details
bek gate --checklist <id>      # Run quality gate
```

## Code Generation Guidelines

### API Responses

Always use structured responses:

```json
{
  "data": {},
  "meta": { "requestId": "string", "timestamp": "ISO8601" }
}
```

### Error Responses

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly message",
    "details": [],
    "requestId": "string"
  }
}
```

### HTTP Status Codes

- `400` Bad Request - Validation errors
- `401` Unauthorized - Missing/invalid auth
- `403` Forbidden - Insufficient permissions
- `404` Not Found - Resource doesn't exist
- `409` Conflict - Duplicate resource
- `429` Too Many Requests - Rate limited
- `500` Internal Server Error - Server issues

### Database Operations

- Use transactions for multi-step operations
- Implement soft deletes when appropriate
- Add `created_at`/`updated_at` timestamps
- Use UUIDs for public-facing IDs
- Use parameterized queries (prevent SQL injection)

### Security

- Hash passwords with bcrypt/argon2
- Sanitize all inputs
- Validate JWTs properly
- Implement rate limiting
- Never log sensitive data

### Testing

Generate tests that:
- Cover happy paths and error cases
- Mock external dependencies
- Use AAA pattern (Arrange, Act, Assert)
- Include edge cases from pattern Pitfalls

## Language-Specific

### TypeScript/JavaScript
- Use strict TypeScript
- Prefer `const` over `let`
- Use async/await
- Define interfaces for data structures

### Python
- Use type hints
- Follow PEP 8
- Use Pydantic models
- Handle exceptions explicitly

### Go
- Handle all errors explicitly
- Use context for cancellation
- Follow standard project layout

## Available Checklists

| ID | Purpose |
|----|---------|
| `checklist-api-review` | API design review |
| `checklist-db-review` | Database review |
| `checklist-security-review` | Security audit |
| `checklist-reliability-review` | Resilience check |
| `checklist-prod-readiness` | Pre-deployment |

## Pattern Categories

- **API**: Error model, pagination, versioning, idempotency
- **Security**: Auth, RBAC, rate limiting, secrets
- **Database**: Migrations, indexing, connection pools
- **Reliability**: Circuit breaker, retries, timeouts
- **Observability**: Logging, metrics, tracing
- Error Model: `.shared/production-backend-kit/patterns/api.error-model.md`
- Pagination: `.shared/production-backend-kit/patterns/api.pagination-filter-sort.md`
- API Review: `.shared/production-backend-kit/checklists/checklist.api-review.md`
