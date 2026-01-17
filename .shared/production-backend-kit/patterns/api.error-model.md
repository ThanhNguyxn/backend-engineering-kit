---
id: api-error-model
title: API Error Model
tags:
  - api
  - error-handling
  - rest
  - http
level: beginner
stacks:
  - all
scope: api
maturity: stable
---

# API Error Model

## Problem

APIs return errors in inconsistent formats, making client-side error handling fragile and debugging difficult. Without a standard structure, developers waste time parsing different error shapes.

## When to use

- Building any REST or GraphQL API
- Designing public or internal APIs
- When multiple teams consume your API
- When you need consistent error handling across services

## Solution

1. **Define a standard error envelope**
   - Always wrap errors in an `error` object
   - Include machine-readable code (SCREAMING_SNAKE)
   - Include human-readable message
   - Add request ID for tracing

2. **Map errors to HTTP status codes**
   - 400: Validation errors
   - 401: Missing/invalid authentication
   - 403: Insufficient permissions
   - 404: Resource not found
   - 409: Conflict (duplicate)
   - 429: Rate limit exceeded
   - 500: Internal server error

3. **Add field-level details for validation**
   - Include array of field errors
   - Each with field name, code, and message

4. **Include metadata**
   - Timestamp (ISO 8601)
   - Request ID
   - Optional documentation link

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Exposing stack traces | Only log server-side, return generic message |
| Inconsistent structures | Use shared error factory/middleware |
| Returning 200 for errors | Always use appropriate 4xx/5xx codes |
| Leaking internal details | Sanitize error messages before returning |
| Missing request ID | Generate at edge, propagate everywhere |

## Checklist

- [ ] Error response has consistent JSON structure
- [ ] Machine-readable error code defined
- [ ] Human-readable message included
- [ ] Request ID present in every error
- [ ] HTTP status code matches error type
- [ ] Stack traces never exposed to clients
- [ ] Validation errors include field-level details
- [ ] Error codes documented in API spec
- [ ] Logging captures full context server-side
- [ ] Error messages are localizable

## Snippets (Generic)

```
Error Response Structure:
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {"field": "email", "code": "INVALID_FORMAT", "message": "Must be valid email"}
    ],
    "requestId": "req_abc123",
    "timestamp": "2026-01-14T12:00:00Z"
  }
}

Steps:
1. Create error factory with (code, message, details?) signature
2. Attach request ID from context/middleware
3. Map exception types to HTTP status codes
4. Log full error with stack server-side
5. Return sanitized error to client
```

## Sources

- RFC 7807 - Problem Details for HTTP APIs: https://datatracker.ietf.org/doc/html/rfc7807
- Google API Design Guide - Errors: https://cloud.google.com/apis/design/errors
- Microsoft REST API Guidelines - Error Handling: https://github.com/microsoft/api-guidelines/blob/vNext/Guidelines.md
- Zalando RESTful API Guidelines: https://opensource.zalando.com/restful-api-guidelines/
