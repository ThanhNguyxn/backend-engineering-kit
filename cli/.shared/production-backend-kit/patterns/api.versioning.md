---
id: api-versioning
title: API Versioning
tags:
  - api
  - versioning
  - rest
  - backward-compatibility
  - evolution
level: intermediate
stacks:
  - all
scope: api
maturity: stable
version: 2.0.0
sources:
  - https://cloud.google.com/apis/design/versioning
  - https://opensource.zalando.com/restful-api-guidelines/#compatible-extensions
  - https://github.com/microsoft/api-guidelines/blob/vNext/Guidelines.md
---

# API Versioning

## Problem

APIs evolve over time. Without versioning, breaking changes disrupt existing clients. Poor versioning strategy leads to maintenance burden and client frustration. The challenge is balancing evolution with stability.

## When to use

- Public APIs consumed by third parties
- Internal APIs with multiple consumer teams
- When breaking changes are anticipated
- Long-lived APIs requiring evolution
- Microservices with independent deployment
- APIs with SLA/contract requirements

## Solution

### 1. Choose Versioning Strategy

| Strategy | Example | Pros | Cons |
|----------|---------|------|------|
| **URL Path** | `/v1/users` | Explicit, cacheable, easy routing | URL changes, not RESTful purist |
| **Header** | `Accept: application/vnd.api+json;version=1` | Clean URLs, content negotiation | Hidden, harder to test |
| **Query Param** | `/users?version=1` | Easy to add | Caching issues, less clean |
| **Media Type** | `Accept: application/vnd.company.v1+json` | Full content negotiation | Complex, verbose |

**Recommendation**: URL path versioning (`/v1/`) for most cases - explicit and cache-friendly.

### 2. Define What's Breaking vs Non-Breaking

**Non-Breaking (Safe)**:
- Adding new endpoints
- Adding optional request fields
- Adding response fields
- Adding new enum values (if client handles unknown)
- Relaxing validation (accepting more)

**Breaking (Requires New Version)**:
- Removing/renaming endpoints
- Removing/renaming fields
- Changing field types
- Changing required/optional
- Tightening validation (rejecting previously valid)
- Changing error formats
- Changing authentication

### 3. Version Lifecycle Management

```
Alpha (v1-alpha) → Beta (v1-beta) → GA (v1) → Deprecated → Sunset
    ↓                   ↓              ↓           ↓           ↓
  Unstable          Breaking OK    Stable    6-12 months    Removed
```

### 4. Deprecation Headers (RFC 8594)

```http
Deprecation: true
Deprecation: @1735689600
Sunset: Sat, 01 Jan 2028 00:00:00 GMT
Link: </v2/users>; rel="successor-version"
```

### 5. Minimize Breaking Changes

- **Add, don't remove**: New fields, new endpoints
- **Make new fields optional**: Backward compatible
- **Use feature flags**: Gradual rollout
- **Nullable over removal**: Mark deprecated, return null
- **Expand-contract pattern**: Add new → migrate → remove old

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Too many versions | Limit to 2-3 active versions max |
| Silent breaking changes | Use API contracts, run compatibility tests |
| No deprecation notice | Add headers, notify consumers proactively |
| Header versioning caching issues | URL versioning is more cache-friendly |
| Versioning internal-only APIs | Consider if you really need versioning |

## Checklist

- [ ] Versioning strategy documented
- [ ] Version included in all API routes
- [ ] Deprecation timeline defined (6-12 months)
- [ ] Deprecation header returned for old versions
- [ ] Changelog maintained per version
- [ ] Breaking changes trigger major version bump
- [ ] SDKs versioned alongside API
- [ ] Monitoring tracks version adoption
- [ ] Migration guides available
- [ ] Sunset date communicated clearly

## Snippets (Generic)

```
URL Path Versioning:
GET /v1/users          # Version 1
GET /v2/users          # Version 2

Deprecation Headers:
Deprecation: true
Sunset: Sat, 01 Jun 2027 00:00:00 GMT
Link: </v2/users>; rel="successor-version"

Version Lifecycle:
1. v1 (stable) ──┐
2. v2 (beta)     │ overlap period (6-12 months)
3. v1 deprecated │
4. v1 sunset ────┘
5. v2 (stable)

Steps:
1. Define versioning strategy in API guidelines
2. Implement version routing (middleware/gateway)
3. Add deprecation header middleware
4. Set up version adoption metrics
5. Document migration for each major version
```

## Sources

- Stripe API Versioning: https://stripe.com/blog/api-versioning
- Microsoft REST API Guidelines - Versioning: https://github.com/microsoft/api-guidelines
- Google API Design Guide - Versioning: https://cloud.google.com/apis/design/versioning
- Zalando RESTful API Guidelines - Compatibility: https://opensource.zalando.com/restful-api-guidelines/
