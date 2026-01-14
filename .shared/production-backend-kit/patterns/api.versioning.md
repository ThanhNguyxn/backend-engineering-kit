---
id: api-versioning
title: API Versioning
tags: [api, versioning, rest, backward-compatibility]
level: intermediate
stacks: [all]
---

# API Versioning

## Problem

APIs evolve over time. Without versioning, breaking changes disrupt existing clients. Poor versioning strategy leads to maintenance burden and client frustration.

## When to use

- Public APIs consumed by third parties
- Internal APIs with multiple consumer teams
- When breaking changes are anticipated
- Long-lived APIs requiring evolution
- Microservices with independent deployment

## Solution

1. **Choose versioning strategy**
   - **URL path** (recommended): `/v1/users` - most explicit, cacheable
   - **Header**: `Accept: application/vnd.api+json;version=1`
   - **Query param**: `?version=1` - easy but less clean

2. **Define version lifecycle**
   - Alpha/Beta → Stable → Deprecated → Sunset
   - Communicate deprecation timeline (e.g., 6-12 months)
   - Use `Deprecation` and `Sunset` headers

3. **Minimize breaking changes**
   - Add fields, don't remove
   - Make new fields optional
   - Use feature flags for gradual rollout

4. **Document migration paths**
   - Changelog for each version
   - Migration guides for breaking changes
   - SDK updates aligned with API versions

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
