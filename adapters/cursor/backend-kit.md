---
name: backend-kit
description: Production backend engineering rules and commands for Cursor IDE
globs:
  - "**/*.py"
  - "**/*.js"
  - "**/*.ts"
  - "**/*.go"
  - "**/*.java"
  - "**/*.rs"
---

# Backend Kit Rules for Cursor

## Overview

This rule file provides production-grade backend engineering guidance for Cursor IDE.

## API Design Rules

### Error Handling

When writing error handling code:

1. **Use structured error responses**
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

2. **Map errors to correct HTTP status codes**
   - `400` - Bad Request (validation errors)
   - `401` - Unauthorized (missing/invalid auth)
   - `403` - Forbidden (insufficient permissions)
   - `404` - Not Found
   - `409` - Conflict (duplicate resource)
   - `422` - Unprocessable Entity
   - `429` - Too Many Requests
   - `500` - Internal Server Error

### Pagination

When implementing list endpoints:

1. **Use cursor-based pagination** for large datasets
2. **Use offset-based pagination** for smaller, static datasets
3. **Always include metadata**:
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

### Input Validation

1. **Validate all inputs** at the controller level
2. **Sanitize data** before database operations
3. **Use schema validation** (Zod, Joi, Pydantic, etc.)

## Code Style Rules

### Naming Conventions

- **Endpoints**: Use kebab-case (`/user-profiles`)
- **Database tables**: Use snake_case (`user_profiles`)
- **Variables**: Use camelCase (JS/TS) or snake_case (Python/Go)

### Documentation

- **Document all endpoints** with OpenAPI/Swagger
- **Include request/response examples**
- **Document error codes**

## Security Rules

1. **Never log sensitive data** (passwords, tokens, PII)
2. **Use parameterized queries** to prevent SQL injection
3. **Validate Content-Type headers**
4. **Implement rate limiting** on all public endpoints
5. **Use HTTPS** in production

## Performance Rules

1. **Use database indexes** for frequently queried fields
2. **Implement caching** for read-heavy endpoints
3. **Use connection pooling** for database connections
4. **Set appropriate timeouts** for external calls

## Commands

### `/api-review`
Run the API review checklist on the current file.

### `/error-model`
Generate a standardized error response structure.

### `/pagination`
Add pagination support to the current endpoint.

## References

- [Patterns](/.shared/production-backend-kit/patterns/)
- [Checklists](/.shared/production-backend-kit/checklists/)
