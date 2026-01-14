---
name: production-backend-kit
description: A comprehensive backend engineering skill providing patterns, checklists, and best practices for building production-ready APIs and services.
version: 1.0.0
author: ThanhNguyxn
---

# Production Backend Kit Skill

This skill provides you with production-grade patterns and checklists for backend engineering.

## Capabilities

When this skill is active, you can help with:

### 🎯 API Design
- RESTful API design patterns
- Error handling and response structures
- Pagination, filtering, and sorting
- Versioning strategies

### 🔒 Security
- Authentication & Authorization patterns
- Input validation and sanitization
- Rate limiting and throttling
- CORS configuration

### 📊 Database
- Schema design best practices
- Query optimization
- Migration strategies
- Connection pooling

### 🚀 Performance
- Caching strategies
- Async processing
- Load balancing
- Monitoring and observability

## Available Patterns

Access these patterns in `.shared/production-backend-kit/patterns/`:

| Pattern | File | Description |
|---------|------|-------------|
| Error Model | `api.error-model.md` | Standardized error response structure |
| Pagination | `api.pagination-filter-sort.md` | RESTful pagination, filtering, sorting |

## Available Checklists

Access these checklists in `.shared/production-backend-kit/checklists/`:

| Checklist | File | Description |
|-----------|------|-------------|
| API Review | `checklist.api-review.md` | Comprehensive API review checklist |

## Usage

When asked about backend development, apply these principles:

1. **Always validate input** - Never trust client data
2. **Use proper HTTP status codes** - 2xx for success, 4xx for client errors, 5xx for server errors
3. **Implement idempotency** - Especially for POST/PUT operations
4. **Log everything** - But sanitize sensitive data
5. **Handle errors gracefully** - Return meaningful error messages

## Example Interactions

**User**: "How should I structure my API error responses?"

**Response**: Apply the error model pattern from `api.error-model.md`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address"
      }
    ],
    "requestId": "req_abc123",
    "timestamp": "2026-01-14T12:00:00Z"
  }
}
```

**User**: "How do I implement pagination?"

**Response**: Follow the pagination pattern from `api.pagination-filter-sort.md` using cursor-based or offset-based pagination depending on your use case.

## Integration

This skill integrates with:
- Database patterns for efficient querying
- Security patterns for safe data handling
- Performance patterns for optimized responses
