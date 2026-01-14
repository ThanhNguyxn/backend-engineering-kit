# GitHub Copilot Instructions - Production Backend Kit

## Context

You are assisting with backend development. Follow these production-grade patterns and best practices.

## Code Generation Guidelines

### API Endpoints

When generating API endpoints:

1. **Always include error handling** with proper HTTP status codes
2. **Validate all input** before processing
3. **Use consistent response structures**
4. **Document with JSDoc/docstrings**

Example response structure:
```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "string",
    "timestamp": "ISO8601"
  }
}
```

### Error Responses

Generate error responses following this pattern:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly message",
    "details": []
  }
}
```

### Database Operations

1. **Use transactions** for multi-step operations
2. **Implement soft deletes** when appropriate
3. **Add created_at/updated_at timestamps**
4. **Use UUIDs** for public-facing IDs

### Security

1. **Hash passwords** with bcrypt/argon2
2. **Sanitize all inputs**
3. **Use parameterized queries**
4. **Validate JWTs properly**
5. **Implement rate limiting**

### Testing

Generate tests that:
1. Cover happy paths and error cases
2. Mock external dependencies
3. Use descriptive test names
4. Follow AAA pattern (Arrange, Act, Assert)

## Language-Specific Guidelines

### TypeScript/JavaScript

- Use strict TypeScript
- Prefer `const` over `let`
- Use async/await over callbacks
- Define interfaces for all data structures

### Python

- Use type hints
- Follow PEP 8
- Use dataclasses or Pydantic models
- Handle exceptions explicitly

### Go

- Handle all errors explicitly
- Use context for cancellation
- Follow standard project layout
- Use interfaces for dependencies

## Response Format

When explaining code:
1. Be concise but thorough
2. Highlight security considerations
3. Mention performance implications
4. Suggest tests to write

## Resources

Refer to these patterns:
- Error Model: `.shared/production-backend-kit/patterns/api.error-model.md`
- Pagination: `.shared/production-backend-kit/patterns/api.pagination-filter-sort.md`
- API Review: `.shared/production-backend-kit/checklists/checklist.api-review.md`
