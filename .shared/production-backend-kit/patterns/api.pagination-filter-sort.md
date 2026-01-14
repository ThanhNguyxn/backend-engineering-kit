---
id: api-pagination-filter-sort
title: API Pagination, Filter & Sort
tags: [api, pagination, filtering, sorting, rest]
level: intermediate
stacks: [all]
---

# API Pagination, Filter & Sort

## Problem

List endpoints returning unbounded results cause performance issues, memory exhaustion, and poor UX. Without standard pagination, clients can't efficiently navigate large datasets.

## When to use

- Any endpoint returning collections
- Large datasets (>100 items potential)
- Admin dashboards, data tables
- Infinite scroll UIs
- Real-time feeds

## Solution

1. **Choose pagination strategy**
   - **Offset-based**: Simple, supports random access, bad for real-time
   - **Cursor-based**: Consistent with inserts, good for real-time, no random access

2. **Implement with constraints**
   - Set maximum page size (e.g., 100)
   - Default to sensible limit (e.g., 20)
   - Return pagination metadata

3. **Add filtering support**
   - Simple: `?status=active&type=premium`
   - Advanced: `?filter[price][gte]=100`
   - Validate filter fields against allowlist

4. **Add sorting support**
   - Single: `?sort=created_at` or `?sort=-created_at`
   - Multi: `?sort=-created_at,name`
   - Only allow indexed columns

5. **Return complete metadata**
   - Total count (if performant)
   - Has more flag
   - Next/prev links (HATEOAS)

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Unlimited page sizes | Enforce max (e.g., 100 items) |
| Offset with real-time data | Use cursor-based pagination |
| Filtering non-indexed fields | Allowlist filterable fields |
| Expensive total counts | Make optional or use estimates |
| Sort on unindexed columns | Validate against index list |

## Checklist

- [ ] Maximum page size enforced
- [ ] Default page size is sensible (20-25)
- [ ] Pagination metadata included in response
- [ ] Filter fields validated against allowlist
- [ ] Sort fields validated against indexed columns
- [ ] Cursor pagination used for real-time data
- [ ] Total count is optional or estimated for large sets
- [ ] HATEOAS links provided (self, next, prev)
- [ ] Empty results return `[]`, not null
- [ ] Query params documented in API spec

## Snippets (Generic)

```
Offset-based Request:
GET /api/users?page=2&per_page=20&sort=-created_at&status=active

Response Structure:
{
  "data": [...],
  "pagination": {
    "page": 2,
    "per_page": 20,
    "total": 150,
    "has_more": true
  },
  "links": {
    "next": "/api/users?page=3&per_page=20",
    "prev": "/api/users?page=1&per_page=20"
  }
}

Cursor-based Request:
GET /api/posts?limit=20&cursor=eyJpZCI6MTAwfQ

Steps:
1. Parse pagination params with defaults
2. Validate and cap page size
3. Apply filters (validate against allowlist)
4. Apply sorting (validate against indexes)
5. Execute query with LIMIT + 1 (to detect has_more)
6. Build response with metadata
```

## Sources

- Slack API Pagination: https://api.slack.com/docs/pagination
- Stripe API Pagination: https://stripe.com/docs/api/pagination
- JSON:API Specification - Pagination: https://jsonapi.org/format/#fetching-pagination
- GraphQL Cursor Connections Spec: https://relay.dev/graphql/connections.htm
