---
title: API Error Model
description: Standardized error response structure for RESTful APIs
category: patterns
tags:
  - api
  - error-handling
  - rest
version: 1.0.0
---

# API Error Model

## Overview

A consistent error response structure ensures clients can reliably handle errors across all API endpoints.

## Error Response Structure

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid parameters",
    "details": [
      {
        "field": "email",
        "code": "INVALID_FORMAT",
        "message": "Must be a valid email address"
      },
      {
        "field": "age",
        "code": "OUT_OF_RANGE",
        "message": "Must be between 18 and 120"
      }
    ],
    "requestId": "req_abc123xyz",
    "timestamp": "2026-01-14T12:00:00Z",
    "documentation": "https://api.example.com/docs/errors#VALIDATION_ERROR"
  }
}
```

## Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | ✅ | Machine-readable error code (SCREAMING_SNAKE_CASE) |
| `message` | string | ✅ | Human-readable error message |
| `details` | array | ❌ | Field-level errors for validation failures |
| `requestId` | string | ✅ | Unique identifier for tracing |
| `timestamp` | string | ✅ | ISO 8601 timestamp |
| `documentation` | string | ❌ | Link to error documentation |

## Standard Error Codes

### Client Errors (4xx)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INVALID_JSON` | 400 | Malformed JSON in request body |
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid authentication |
| `TOKEN_EXPIRED` | 401 | Authentication token has expired |
| `PERMISSION_DENIED` | 403 | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource doesn't exist |
| `METHOD_NOT_ALLOWED` | 405 | HTTP method not supported |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

### Server Errors (5xx)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |
| `GATEWAY_TIMEOUT` | 504 | Upstream service timeout |

## Implementation Examples

### TypeScript

```typescript
interface ApiError {
  code: string;
  message: string;
  details?: FieldError[];
  requestId: string;
  timestamp: string;
  documentation?: string;
}

interface FieldError {
  field: string;
  code: string;
  message: string;
}

interface ErrorResponse {
  error: ApiError;
}

function createError(
  code: string,
  message: string,
  requestId: string,
  details?: FieldError[]
): ErrorResponse {
  return {
    error: {
      code,
      message,
      details,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}
```

### Python

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

@dataclass
class FieldError:
    field: str
    code: str
    message: str

@dataclass
class ApiError:
    code: str
    message: str
    request_id: str
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    details: Optional[list[FieldError]] = None
    documentation: Optional[str] = None

@dataclass
class ErrorResponse:
    error: ApiError
```

## Best Practices

1. **Always include request ID** - Essential for debugging and support
2. **Use consistent error codes** - Define a central error code registry
3. **Keep messages user-friendly** - Don't expose internal details
4. **Localize messages** - Support i18n via Accept-Language header
5. **Log full context server-side** - Only return safe info to clients
6. **Include documentation links** - Help developers self-serve

## Anti-Patterns

❌ **Don't expose stack traces**
```json
{
  "error": "NullPointerException at com.example.Service.process(Service.java:42)"
}
```

❌ **Don't use inconsistent structures**
```json
// Sometimes this...
{ "error": "Something went wrong" }
// Sometimes this...
{ "message": "Error occurred", "status": 500 }
```

❌ **Don't return 200 for errors**
```json
// HTTP 200 OK
{ "success": false, "error": "Not found" }
```

## Related Patterns

- [Pagination, Filter & Sort](./api.pagination-filter-sort.md)
