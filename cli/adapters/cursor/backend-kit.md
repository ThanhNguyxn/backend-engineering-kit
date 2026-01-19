# Backend Kit Rules

This project uses **Backend Engineering Kit (BEK)** for production backend patterns.

## CLI

```bash
bek search "error handling"    # Find patterns
bek show api-error-model       # View details
bek gate --checklist <id>      # Quality gate
```

## Error Handling

Use structured error responses:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": [],
    "requestId": "unique-id"
  }
}
```

HTTP status mapping:
- `400` Bad Request - Validation errors
- `401` Unauthorized - Missing/invalid auth
- `403` Forbidden - Insufficient permissions
- `404` Not Found
- `409` Conflict - Duplicate resource
- `422` Unprocessable Entity
- `429` Too Many Requests - Rate limited
- `500` Internal Server Error

## Pagination

Cursor-based for large/real-time datasets:
```json
{
  "data": [],
  "pagination": {
    "cursor": "eyJpZCI6MTAwfQ",
    "hasMore": true
  }
}
```

Offset-based for smaller, static datasets:
```json
{
  "data": [],
  "pagination": {
    "total": 100,
    "page": 1,
    "perPage": 20,
    "hasMore": true
  }
}
```

## Input Validation

- Validate all inputs at controller level
- Sanitize before database operations
- Use schema validation (Zod, Joi, Pydantic)
- Return field-level error details

## Security Rules

- Never log sensitive data (passwords, tokens, PII)
- Use parameterized queries (prevent SQL injection)
- Validate Content-Type headers
- Implement rate limiting on public endpoints
- Use HTTPS in production
- Hash passwords with bcrypt/argon2

## Database Rules

- Use indexes for frequently queried fields
- Implement connection pooling
- Use transactions for multi-step operations
- Add `created_at`/`updated_at` timestamps
- Consider soft deletes

## Reliability Rules

- Set timeouts for external calls
- Implement circuit breakers for dependencies
- Use exponential backoff for retries
- Include health check endpoints

## Naming Conventions

- Endpoints: kebab-case (`/user-profiles`)
- Database: snake_case (`user_profiles`)
- Variables: camelCase (JS/TS) or snake_case (Python/Go)

## Available Checklists

Run with `bek gate --checklist <id>`:

| ID | Purpose |
|----|---------|
| `checklist-api-review` | API design review |
| `checklist-db-review` | Database review |
| `checklist-security-review` | Security audit |
| `checklist-reliability-review` | Resilience check |
| `checklist-prod-readiness` | Pre-deployment |

## Commands

### `/api-review`
Run the API review checklist on the current file.

### `/error-model`
Generate a standardized error response structure.

### `/pagination`
Add pagination support to the current endpoint.

## References

- [Patterns](.shared/production-backend-kit/patterns/)
- [Checklists](.shared/production-backend-kit/checklists/)
