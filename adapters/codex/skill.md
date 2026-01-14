---
name: production-backend-kit
description: Backend engineering patterns and checklists for production APIs
---

# Production Backend Kit for Codex

## Purpose

Provides production-ready patterns for backend API development.

## Core Patterns

### Error Handling

Use structured error responses:
- Include error code, message, and details
- Map to appropriate HTTP status codes
- Add request ID for tracing

### Pagination

Support both cursor-based and offset-based:
- Cursor for real-time data
- Offset for static lists
- Always return total count and hasMore flag

### Validation

- Validate at API boundary
- Use schema validation libraries
- Return field-level error details

## Quick Reference

| Pattern | File |
|---------|------|
| Error Model | `patterns/api.error-model.md` |
| Pagination | `patterns/api.pagination-filter-sort.md` |

| Checklist | File |
|-----------|------|
| API Review | `checklists/checklist.api-review.md` |

## Usage

When generating backend code:
1. Apply error handling patterns
2. Include input validation  
3. Use proper HTTP methods and status codes
4. Add appropriate logging
5. Consider security implications

## Best Practices

- ✅ Use consistent naming conventions
- ✅ Document all endpoints
- ✅ Write tests for all paths
- ✅ Handle edge cases
- ❌ Never log sensitive data
- ❌ Never trust client input
- ❌ Never expose internal errors
