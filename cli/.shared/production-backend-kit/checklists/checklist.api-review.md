---
id: checklist-api-review
title: API Review Checklist
description: Comprehensive checklist for reviewing REST API implementations
category: checklists
tags:
  - api
  - rest
  - review
  - quality
  - design
version: 2.0.0
scope: api
level: intermediate
maturity: stable
stacks:
  - all
sources:
  - https://cloud.google.com/apis/design
  - https://github.com/microsoft/api-guidelines
  - https://opensource.zalando.com/restful-api-guidelines/
  - https://jsonapi.org/
---

# API Review Checklist

Use this checklist when reviewing API endpoints before deployment.

---

## 🎯 Resource Design & Naming

### URL Structure
- [ ] URLs use nouns, not verbs (`/users`, not `/getUsers`)
- [ ] Collection names are plural (`/users`, `/orders`)
- [ ] Resource names are lowercase with hyphens (`/user-profiles`)
- [ ] Nested resources max 2 levels (`/users/{id}/orders`)
- [ ] Actions use sub-resources (`/orders/{id}/actions/cancel`)

### HTTP Methods
- [ ] GET - Read (safe, idempotent)
- [ ] POST - Create or complex operations
- [ ] PUT - Full update (idempotent)
- [ ] PATCH - Partial update
- [ ] DELETE - Remove (idempotent)

### Resource Identifiers
- [ ] IDs are URL-safe (alphanumeric, hyphens)
- [ ] Prefer UUIDs for external IDs (security)
- [ ] Consistent ID format across resources
- [ ] Self-link included in responses (HATEOAS optional)

### Versioning
- [ ] Version in URL path (`/v1/users`) OR header (`Accept-Version`)
- [ ] One versioning strategy used consistently
- [ ] Breaking changes require new version
- [ ] Deprecation timeline documented

---

## 📥 Request Handling

### Input Validation
- [ ] Request body schema defined (JSON Schema, OpenAPI)
- [ ] Required vs optional fields documented
- [ ] Validation runs before business logic
- [ ] Appropriate error messages for validation failures
- [ ] Type coercion disabled (strict types)

### Content Handling
- [ ] `Content-Type: application/json` required for bodies
- [ ] Charset UTF-8 enforced
- [ ] Request size limits configured
- [ ] Nested depth limits enforced
- [ ] Array length limits enforced

### File Uploads
- [ ] File type validated (magic bytes, not extension)
- [ ] File size limited
- [ ] Filename sanitized
- [ ] Uploaded to secure storage (not web-accessible)
- [ ] Virus scanning (if applicable)

### Query Parameters
- [ ] Consistent casing (snake_case or camelCase)
- [ ] Boolean values standardized (`true`/`false`)
- [ ] Unknown parameters ignored or rejected (documented)
- [ ] Array parameters use consistent format (`?id=1&id=2` or `?ids=1,2`)

---

## 📤 Response Design

### Response Structure
```json
{
  "data": { ... },
  "meta": {
    "requestId": "abc-123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Success Responses
- [ ] 200 OK - Successful GET, PUT, PATCH
- [ ] 201 Created - Successful POST (include Location header)
- [ ] 204 No Content - Successful DELETE
- [ ] 202 Accepted - Async operation started

### Response Consistency
- [ ] Empty arrays return `[]`, not `null`
- [ ] Absent optional fields omitted (not `null`)
- [ ] Dates in ISO 8601 (`2024-01-15T10:30:00Z`)
- [ ] Money as smallest unit (cents) or string with currency
- [ ] Consistent property naming (camelCase or snake_case)

### Response Headers
- [ ] `Content-Type: application/json`
- [ ] `X-Request-Id` for correlation
- [ ] Cache headers appropriate (`Cache-Control`, `ETag`)
- [ ] `Location` header on 201 Created

---

## ❌ Error Handling

### Error Response Structure (RFC 7807)
```json
{
  "type": "https://api.example.com/errors/validation-error",
  "title": "Validation Failed",
  "status": 400,
  "detail": "Email format is invalid",
  "instance": "/users/123",
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ],
  "traceId": "abc-123"
}
```

### Status Codes
| Code | Usage |
|------|-------|
| 400 | Bad Request - Validation failed |
| 401 | Unauthorized - No/invalid authentication |
| 403 | Forbidden - No permission |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource state conflict |
| 422 | Unprocessable - Semantic validation error |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Error - Server fault |
| 503 | Service Unavailable - Temporary outage |

### Error Checklist
- [ ] Error format consistent across all endpoints
- [ ] Error messages don't leak sensitive info
- [ ] Validation errors list all fields
- [ ] Error type URIs resolvable (optional but nice)
- [ ] Machine-readable error codes for clients

---

## 📊 Pagination

### Offset Pagination (simple, has issues at scale)
```
GET /users?limit=20&offset=40
```
- [ ] Default limit set (e.g., 20)
- [ ] Maximum limit enforced (e.g., 100)
- [ ] Total count provided (careful with large tables)

### Cursor Pagination (recommended for large datasets)
```
GET /users?limit=20&cursor=eyJpZCI6MTAwfQ==
```
- [ ] Cursor is opaque (encoded)
- [ ] Next cursor in response
- [ ] Consistent ordering (e.g., id DESC)

### Pagination Response
```json
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "hasMore": true,
    "nextCursor": "eyJpZCI6ODB9"
  }
}
```

---

## 🔍 Filtering & Sorting

### Filtering
- [ ] Filters on indexed columns
- [ ] Filter syntax documented
- [ ] Complex filters limited (prevent query bombing)
- [ ] Example: `?status=active&created_after=2024-01-01`

### Sorting
- [ ] Sort syntax consistent (`?sort=created_at` or `?sort=-created_at`)
- [ ] Descending with `-` prefix or `order=desc`
- [ ] Sort on indexed columns only
- [ ] Default sort order documented

### Field Selection
- [ ] Sparse fieldsets supported (`?fields=id,name,email`)
- [ ] Related resource expansion (`?include=orders`)
- [ ] Depth limit for expansions

---

## 🔐 Security

### Authentication
- [ ] Auth required for protected endpoints
- [ ] Auth mechanism documented (Bearer, API Key)
- [ ] 401 for missing/invalid auth
- [ ] 403 for insufficient permissions

### Authorization
- [ ] Resource-level permissions checked
- [ ] IDOR prevention (user can only access own resources)
- [ ] Admin endpoints protected

### Rate Limiting
- [ ] Rate limits configured
- [ ] `X-RateLimit-*` headers returned
- [ ] 429 response with `Retry-After` header
- [ ] Different limits per endpoint sensitivity

### Input Security
- [ ] SQL injection prevented (parameterized queries)
- [ ] Mass assignment prevented (allowlist fields)
- [ ] Path traversal prevented
- [ ] Request size limits configured

---

## ⚡ Performance

### Efficiency
- [ ] N+1 queries prevented (eager loading)
- [ ] Response size reasonable
- [ ] Expensive operations async (202 Accepted)
- [ ] Batch endpoints for multiple operations

### Caching
- [ ] `Cache-Control` headers appropriate
- [ ] `ETag` / `Last-Modified` for conditional requests
- [ ] 304 Not Modified supported
- [ ] Vary header for content negotiation

### Idempotency
- [ ] POST endpoints accept `Idempotency-Key` header
- [ ] PUT/DELETE are naturally idempotent
- [ ] Retry-safe operations documented

---

## 📝 Documentation

### OpenAPI/Swagger
- [ ] Spec file exists and up-to-date
- [ ] All endpoints documented
- [ ] All request/response schemas defined
- [ ] Examples provided for all operations
- [ ] Error responses documented

### Developer Experience
- [ ] Authentication guide
- [ ] Quickstart example
- [ ] Error handling guide
- [ ] Rate limiting documentation
- [ ] Changelog maintained

---

## ✅ Review Summary

| Category | Status | Reviewer | Notes |
|----------|--------|----------|-------|
| Resource Design | [ ] | | |
| Request Handling | [ ] | | |
| Response Design | [ ] | | |
| Error Handling | [ ] | | |
| Pagination | [ ] | | |
| Security | [ ] | | |
| Performance | [ ] | | |
| Documentation | [ ] | | |

---

## Sign-Off

| Role | Name | Date |
|------|------|------|
| API Reviewer | | |
| Security Review | | |

---

## Sources

- [Google API Design Guide](https://cloud.google.com/apis/design)
- [Microsoft REST API Guidelines](https://github.com/microsoft/api-guidelines)
- [Zalando RESTful API Guidelines](https://opensource.zalando.com/restful-api-guidelines/)
- [JSON:API Specification](https://jsonapi.org/)
- [RFC 7807 - Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc7807)
