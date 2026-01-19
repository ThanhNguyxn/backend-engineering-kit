---
id: api-error-model
title: API Error Model (RFC 7807)
tags:
  - api
  - error-handling
  - rest
  - http
  - rfc7807
level: beginner
stacks:
  - all
scope: api
maturity: stable
version: 2.0.0
sources:
  - https://datatracker.ietf.org/doc/html/rfc7807
  - https://opensource.zalando.com/restful-api-guidelines/#176
  - https://cloud.google.com/apis/design/errors
  - https://stripe.com/docs/api/errors
---

# API Error Model (RFC 7807)

## Problem

APIs return errors in inconsistent formats across services, making client-side error handling fragile, debugging difficult, and documentation incomplete. Teams waste time parsing different error shapes and writing custom error handlers.

## When to use

- **Always** for REST/HTTP APIs (public or internal)
- GraphQL APIs (adapt to GraphQL errors extension)
- When multiple teams/clients consume your API
- Any service that needs consistent error contracts

## Solution: RFC 7807 Problem Details

Use the **RFC 7807 Problem Details** standard - widely adopted by Google, Zalando, and Microsoft.

### 1. Standard Error Structure

```json
{
  "type": "https://api.example.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "The 'email' field is not a valid email address",
  "instance": "/users/registration",
  "traceId": "req_abc123xyz",
  "timestamp": "2026-01-19T12:00:00Z",
  "errors": [
    {
      "field": "email",
      "code": "INVALID_FORMAT",
      "message": "Must be a valid email address",
      "rejectedValue": "not-an-email"
    },
    {
      "field": "age",
      "code": "MIN_VALUE",
      "message": "Must be at least 18",
      "rejectedValue": 15
    }
  ]
}
```

### 2. Required Fields (RFC 7807)

| Field | Type | Description |
|-------|------|-------------|
| `type` | URI | Machine-readable error type (use docs URL) |
| `title` | string | Short, human-readable summary |
| `status` | integer | HTTP status code (redundant but useful) |
| `detail` | string | Human-readable explanation specific to this occurrence |
| `instance` | string | URI reference to the specific occurrence |

### 3. Extended Fields (Recommended)

| Field | Type | Description |
|-------|------|-------------|
| `traceId` | string | Correlation/request ID for debugging |
| `timestamp` | ISO8601 | When the error occurred |
| `errors` | array | Field-level validation errors |
| `code` | string | Application-specific error code |

### 4. HTTP Status Code Mapping

```
┌─────────────────────────────────────────────────────────┐
│ Client Errors (4xx)                                     │
├─────────────────────────────────────────────────────────┤
│ 400 Bad Request      - Malformed syntax, validation     │
│ 401 Unauthorized     - Missing/invalid authentication   │
│ 403 Forbidden        - Valid auth, insufficient perms   │
│ 404 Not Found        - Resource doesn't exist           │
│ 405 Method Not Allow - HTTP method not supported        │
│ 409 Conflict         - State conflict (duplicate, etc)  │
│ 410 Gone             - Resource permanently deleted     │
│ 422 Unprocessable    - Semantic validation failure      │
│ 429 Too Many Request - Rate limit exceeded              │
├─────────────────────────────────────────────────────────┤
│ Server Errors (5xx)                                     │
├─────────────────────────────────────────────────────────┤
│ 500 Internal Error   - Unexpected server failure        │
│ 502 Bad Gateway      - Upstream service failure         │
│ 503 Service Unavail  - Temporarily unavailable          │
│ 504 Gateway Timeout  - Upstream timeout                 │
└─────────────────────────────────────────────────────────┘
```

### 5. Error Code Conventions

Use `SCREAMING_SNAKE_CASE` for machine-readable codes:

```
VALIDATION_ERROR          RESOURCE_NOT_FOUND
AUTHENTICATION_REQUIRED   PERMISSION_DENIED
RATE_LIMIT_EXCEEDED       CONFLICT_DETECTED
INVALID_PARAMETER         MISSING_REQUIRED_FIELD
RESOURCE_EXHAUSTED        PRECONDITION_FAILED
```

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| Exposing stack traces | Security vulnerability, info leak | Log server-side only, return generic message |
| 200 OK with error body | Breaks HTTP semantics, caching | Always use appropriate 4xx/5xx |
| Inconsistent structure | Client fragility, maintenance hell | Use shared error middleware/factory |
| Missing trace ID | Impossible to debug in prod | Generate at edge, propagate everywhere |
| Leaking internal paths | Security risk | Sanitize file paths, DB details |
| Generic "Error occurred" | Poor UX, no actionable info | Provide specific, helpful messages |
| No error documentation | API consumers confused | Document every error type in OpenAPI |

## Checklist

- [ ] Using RFC 7807 Problem Details format
- [ ] `type` URIs resolve to error documentation
- [ ] HTTP status codes correctly mapped
- [ ] `traceId` present in every error response
- [ ] Field-level validation errors in `errors` array
- [ ] Error codes are documented in OpenAPI spec
- [ ] Stack traces never exposed to clients
- [ ] Error messages are helpful and actionable
- [ ] Consistent error handling middleware
- [ ] Server logs include full context (stack, request body)
- [ ] Sensitive data redacted from error details
- [ ] Error responses set `Content-Type: application/problem+json`

## Code Examples

### TypeScript/Node.js

```typescript
// error-types.ts
export class ApiError extends Error {
  constructor(
    public readonly type: string,
    public readonly title: string,
    public readonly status: number,
    public readonly detail: string,
    public readonly errors?: FieldError[]
  ) {
    super(detail);
    this.name = 'ApiError';
  }

  static badRequest(detail: string, errors?: FieldError[]) {
    return new ApiError(
      '/errors/bad-request',
      'Bad Request',
      400,
      detail,
      errors
    );
  }

  static notFound(resource: string, id: string) {
    return new ApiError(
      '/errors/not-found',
      'Not Found',
      404,
      `${resource} with ID '${id}' not found`
    );
  }

  static unauthorized(detail = 'Authentication required') {
    return new ApiError('/errors/unauthorized', 'Unauthorized', 401, detail);
  }

  toJSON(traceId: string) {
    return {
      type: `https://api.example.com${this.type}`,
      title: this.title,
      status: this.status,
      detail: this.detail,
      traceId,
      timestamp: new Date().toISOString(),
      ...(this.errors && { errors: this.errors }),
    };
  }
}

// error-middleware.ts (Express)
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  const traceId = req.headers['x-trace-id'] || crypto.randomUUID();
  
  // Log full error server-side
  logger.error({ err, traceId, path: req.path, method: req.method });

  if (err instanceof ApiError) {
    return res
      .status(err.status)
      .type('application/problem+json')
      .json(err.toJSON(traceId));
  }

  // Unknown errors - don't leak details
  res.status(500).type('application/problem+json').json({
    type: 'https://api.example.com/errors/internal',
    title: 'Internal Server Error',
    status: 500,
    detail: 'An unexpected error occurred',
    traceId,
    timestamp: new Date().toISOString(),
  });
}
```

### Python/FastAPI

```python
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

class FieldError(BaseModel):
    field: str
    code: str
    message: str
    rejected_value: Optional[any] = None

class ProblemDetail(BaseModel):
    type: str
    title: str
    status: int
    detail: str
    instance: Optional[str] = None
    trace_id: str
    timestamp: str
    errors: Optional[List[FieldError]] = None

class ApiError(Exception):
    def __init__(self, type_: str, title: str, status: int, detail: str, 
                 errors: List[FieldError] = None):
        self.type = type_
        self.title = title
        self.status = status
        self.detail = detail
        self.errors = errors

@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):
    trace_id = request.headers.get("x-trace-id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=exc.status,
        content=ProblemDetail(
            type=f"https://api.example.com{exc.type}",
            title=exc.title,
            status=exc.status,
            detail=exc.detail,
            instance=str(request.url.path),
            trace_id=trace_id,
            timestamp=datetime.utcnow().isoformat() + "Z",
            errors=exc.errors,
        ).dict(exclude_none=True),
        media_type="application/problem+json",
    )
```

### Go

```go
package errors

import (
    "encoding/json"
    "net/http"
    "time"
)

type FieldError struct {
    Field         string      `json:"field"`
    Code          string      `json:"code"`
    Message       string      `json:"message"`
    RejectedValue interface{} `json:"rejectedValue,omitempty"`
}

type ProblemDetail struct {
    Type      string       `json:"type"`
    Title     string       `json:"title"`
    Status    int          `json:"status"`
    Detail    string       `json:"detail"`
    Instance  string       `json:"instance,omitempty"`
    TraceID   string       `json:"traceId"`
    Timestamp string       `json:"timestamp"`
    Errors    []FieldError `json:"errors,omitempty"`
}

func WriteError(w http.ResponseWriter, r *http.Request, err *ProblemDetail) {
    err.TraceID = r.Header.Get("X-Trace-ID")
    if err.TraceID == "" {
        err.TraceID = generateTraceID()
    }
    err.Timestamp = time.Now().UTC().Format(time.RFC3339)
    err.Instance = r.URL.Path
    
    w.Header().Set("Content-Type", "application/problem+json")
    w.WriteHeader(err.Status)
    json.NewEncoder(w).Encode(err)
}

func BadRequest(detail string, errors []FieldError) *ProblemDetail {
    return &ProblemDetail{
        Type:   "https://api.example.com/errors/bad-request",
        Title:  "Bad Request",
        Status: http.StatusBadRequest,
        Detail: detail,
        Errors: errors,
    }
}
```

## References

- [RFC 7807 - Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc7807)
- [Zalando RESTful API Guidelines - Error Handling](https://opensource.zalando.com/restful-api-guidelines/#176)
- [Google Cloud API Design - Errors](https://cloud.google.com/apis/design/errors)
- [Stripe API - Error Handling](https://stripe.com/docs/api/errors)
- [Microsoft REST API Guidelines - Error Condition Responses](https://github.com/microsoft/api-guidelines/blob/vNext/Guidelines.md#7102-error-condition-responses)

## Sources

- RFC 7807 - Problem Details for HTTP APIs: https://datatracker.ietf.org/doc/html/rfc7807
- Google API Design Guide - Errors: https://cloud.google.com/apis/design/errors
- Microsoft REST API Guidelines - Error Handling: https://github.com/microsoft/api-guidelines/blob/vNext/Guidelines.md
- Zalando RESTful API Guidelines: https://opensource.zalando.com/restful-api-guidelines/
