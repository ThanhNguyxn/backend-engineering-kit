---
title: API Review Checklist
description: Comprehensive checklist for reviewing API implementations
category: checklists
tags:
  - api
  - review
  - code-review
  - quality
version: 1.0.0
---

# API Review Checklist

## Overview

Use this checklist when reviewing API implementations to ensure production quality.

---

## 🎯 Design & Consistency

- [ ] Endpoint follows RESTful naming conventions
- [ ] HTTP methods are used correctly (GET, POST, PUT, PATCH, DELETE)
- [ ] URL structure is consistent with existing endpoints
- [ ] Resource naming uses plural nouns (`/users`, not `/user`)
- [ ] Nested resources are max 2 levels deep (`/users/{id}/posts`)
- [ ] Query parameters use snake_case or camelCase consistently
- [ ] API versioning is applied if required (`/v1/`, `/v2/`)

## 🔒 Security

- [ ] Authentication is required where appropriate
- [ ] Authorization checks are implemented
- [ ] Input validation is performed on all parameters
- [ ] SQL injection is prevented (parameterized queries)
- [ ] XSS protection is in place for user content
- [ ] Sensitive data is not logged
- [ ] Rate limiting is configured
- [ ] CORS is properly configured
- [ ] Content-Type is validated
- [ ] File uploads are sanitized and size-limited

## 📥 Request Handling

- [ ] Request body schema is defined and validated
- [ ] Required vs optional fields are clearly defined
- [ ] Field types are validated (string, number, etc.)
- [ ] Field constraints are validated (min, max, pattern)
- [ ] Default values are documented and sensible
- [ ] Large payloads are handled gracefully
- [ ] Idempotency is supported for POST/PUT operations

## 📤 Response Handling

- [ ] Response follows standard structure
- [ ] Correct HTTP status codes are returned
- [ ] Error responses follow error model pattern
- [ ] Response includes necessary metadata (request_id, timestamp)
- [ ] Sensitive data is excluded from responses
- [ ] Null values are handled consistently
- [ ] Empty arrays return `[]`, not `null`
- [ ] Date/time uses ISO 8601 format

## 📊 Pagination & Filtering

- [ ] List endpoints support pagination
- [ ] Maximum page size is enforced
- [ ] Sorting is supported where needed
- [ ] Filtering uses indexed database fields
- [ ] Search functionality uses appropriate matching
- [ ] Total count is provided (if performant)

## ⚡ Performance

- [ ] Database queries are optimized
- [ ] N+1 query problem is avoided
- [ ] Proper indexes exist for query patterns
- [ ] Caching headers are set appropriately
- [ ] Response payload size is reasonable
- [ ] Expensive operations are async
- [ ] Timeouts are configured for external calls
- [ ] Connection pooling is used

## 📝 Documentation

- [ ] OpenAPI/Swagger spec is updated
- [ ] Request/response examples are provided
- [ ] Error codes are documented
- [ ] Authentication requirements are documented
- [ ] Rate limits are documented
- [ ] Breaking changes are noted

## 🧪 Testing

- [ ] Unit tests cover business logic
- [ ] Integration tests verify endpoint behavior
- [ ] Happy path is tested
- [ ] Error cases are tested
- [ ] Edge cases are tested (empty, null, max)
- [ ] Authentication/authorization is tested
- [ ] Validation errors are tested
- [ ] Performance/load testing considered

## 📋 Logging & Monitoring

- [ ] Request/response logging is in place
- [ ] Sensitive data is masked in logs
- [ ] Error logging includes context
- [ ] Metrics are captured (latency, status codes)
- [ ] Alerts are configured for errors
- [ ] Request tracing is implemented

## 🔄 Backwards Compatibility

- [ ] Changes are backwards compatible
- [ ] Deprecated fields are marked appropriately
- [ ] Migration path is documented for breaking changes
- [ ] Version negotiation works correctly

---

## Quick Reference: HTTP Status Codes

| Code | Use Case |
|------|----------|
| 200 | Success (GET, PUT, PATCH) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (no/invalid auth) |
| 403 | Forbidden (no permission) |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

## Quick Reference: Review Questions

1. **Security**: "Could a malicious user exploit this?"
2. **Performance**: "What happens with 1M records?"
3. **Reliability**: "What if the database is slow?"
4. **Usability**: "Is this intuitive for API consumers?"
5. **Maintainability**: "Will we understand this in 6 months?"

---

## Related Resources

- [API Error Model](../patterns/api.error-model.md)
- [Pagination, Filter & Sort](../patterns/api.pagination-filter-sort.md)
