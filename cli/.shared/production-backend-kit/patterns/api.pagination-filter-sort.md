---
id: api-pagination-filter-sort
title: 'API Pagination, Filtering & Sorting'
tags:
  - api
  - pagination
  - filtering
  - sorting
  - rest
  - cursor
level: intermediate
stacks:
  - all
scope: api
maturity: stable
version: 2.0.0
sources:
  - https://slack.com/developers/docs/pagination
  - https://stripe.com/docs/api/pagination
  - https://opensource.zalando.com/restful-api-guidelines/#pagination
  - https://relay.dev/graphql/connections.htm
---

# API Pagination, Filtering & Sorting

## Problem

List endpoints returning unbounded results cause:
- Memory exhaustion (server & client)
- Timeout failures on large datasets
- Poor user experience (long load times)
- Inconsistent results with concurrent modifications
- Database performance degradation

## When to use

- **Always** for collection endpoints
- Any endpoint that could return >50 items
- Real-time feeds and timelines
- Admin dashboards and data tables
- Search results

## Solution

### 1. Pagination Strategies Comparison

```
┌─────────────────────────────────────────────────────────────────────┐
│ Strategy        │ Pros                    │ Cons                    │
├─────────────────┼─────────────────────────┼─────────────────────────┤
│ Offset/Page     │ Simple, random access   │ Drift with inserts,     │
│ ?page=2&size=20 │ Jump to any page        │ slow on large offsets   │
├─────────────────┼─────────────────────────┼─────────────────────────┤
│ Cursor-based    │ Stable with writes,     │ No random access,       │
│ ?cursor=xyz     │ Consistent pagination   │ Can't jump to page N    │
├─────────────────┼─────────────────────────┼─────────────────────────┤
│ Keyset/Seek     │ Best performance,       │ Requires sortable key,  │
│ ?after_id=100   │ Works with billions     │ Complex with multi-sort │
└─────────────────────────────────────────────────────────────────────┘

RECOMMENDATION: Use cursor-based for most APIs (Stripe, Slack, GitHub style)
```

### 2. Cursor-Based Pagination (Recommended)

```json
// Request
GET /api/orders?limit=20&cursor=eyJjcmVhdGVkX2F0IjoiMjAyNi0wMS0xOVQxMDowMDowMFoiLCJpZCI6MTAwfQ

// Response
{
  "data": [
    { "id": 101, "created_at": "2026-01-19T10:01:00Z", ... },
    { "id": 102, "created_at": "2026-01-19T10:02:00Z", ... }
  ],
  "pagination": {
    "has_more": true,
    "next_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNi0wMS0xOVQxMDoyMDowMFoiLCJpZCI6MTIwfQ",
    "prev_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNi0wMS0xOVQxMDowMTowMFoiLCJpZCI6MTAxfQ"
  },
  "links": {
    "self": "/api/orders?limit=20&cursor=...",
    "next": "/api/orders?limit=20&cursor=eyJ...",
    "prev": "/api/orders?limit=20&cursor=eyJ..."
  }
}
```

**Cursor encoding**: Base64 of `{ field: value, id: uniqueId }` - always include unique ID for tie-breaker.

### 3. Filtering Best Practices

```bash
# Simple equality
GET /api/products?status=active&category=electronics

# Comparison operators (LHS brackets)
GET /api/products?price[gte]=100&price[lte]=500

# IN operator (comma-separated)
GET /api/products?status=active,pending

# Full-text search
GET /api/products?q=wireless+headphones

# Date ranges (ISO 8601)
GET /api/orders?created_at[gte]=2026-01-01T00:00:00Z
```

**Security**: ALWAYS validate filter fields against an allowlist!

```typescript
const ALLOWED_FILTERS = ['status', 'category', 'price', 'created_at'];
const ALLOWED_OPERATORS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in'];

function validateFilters(filters: Record<string, any>) {
  for (const [field, value] of Object.entries(filters)) {
    const [fieldName, operator = 'eq'] = field.split('[').map(s => s.replace(']', ''));
    
    if (!ALLOWED_FILTERS.includes(fieldName)) {
      throw new ApiError(400, `Invalid filter field: ${fieldName}`);
    }
    if (!ALLOWED_OPERATORS.includes(operator)) {
      throw new ApiError(400, `Invalid operator: ${operator}`);
    }
  }
}
```

### 4. Sorting Best Practices

```bash
# Single field (- prefix for descending)
GET /api/products?sort=-created_at

# Multiple fields (comma-separated)
GET /api/products?sort=-featured,price,-created_at

# Alternative syntax (explicit direction)
GET /api/products?sort_by=created_at&sort_order=desc
```

**Critical**: Only allow sorting on indexed columns!

```typescript
const SORTABLE_FIELDS = new Map([
  ['created_at', { index: 'idx_products_created_at' }],
  ['price', { index: 'idx_products_price' }],
  ['name', { index: 'idx_products_name' }],
]);

function validateSort(sortFields: string[]) {
  for (const field of sortFields) {
    const fieldName = field.replace(/^-/, '');
    if (!SORTABLE_FIELDS.has(fieldName)) {
      throw new ApiError(400, `Cannot sort by: ${fieldName}. Allowed: ${[...SORTABLE_FIELDS.keys()]}`);
    }
  }
}
```

### 5. Response Envelope

```json
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "has_more": true,
    "total": 1547,          // Optional - expensive for large datasets
    "next_cursor": "eyJ...",
    "prev_cursor": "eyJ..."
  },
  "links": {
    "self": "/api/products?limit=20",
    "next": "/api/products?limit=20&cursor=eyJ...",
    "prev": null,
    "first": "/api/products?limit=20"
  },
  "meta": {
    "filters_applied": { "status": "active" },
    "sort_applied": ["-created_at"]
  }
}
```

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| No max page size | Memory exhaustion, DoS | Enforce hard limit (100 max) |
| Offset on huge tables | Slow queries (OFFSET 1000000) | Use cursor/keyset pagination |
| Filter on non-indexed field | Full table scan, timeout | Allowlist indexed fields only |
| Sort on non-indexed field | Full table sort, slow | Validate against index list |
| COUNT(*) on millions | Query timeout | Make total optional or use estimates |
| Offset drift with inserts | Missing/duplicate items | Use cursor-based pagination |
| Exposing internal IDs | Security concern | Use opaque cursors |
| Null vs empty array | Client confusion | Always return `[]` for empty |

## Checklist

- [ ] Max page size enforced (≤100)
- [ ] Default page size set (20-25)
- [ ] Cursor-based pagination for mutable data
- [ ] Filter fields validated against allowlist
- [ ] Sort fields validated against indexed columns
- [ ] Pagination metadata in response
- [ ] HATEOAS links provided (self, next, prev)
- [ ] `has_more` flag included (not just total)
- [ ] Empty results return `[]`, not null
- [ ] Cursors are opaque (base64 encoded)
- [ ] Total count is optional or estimated
- [ ] Documented in OpenAPI spec

## Code Examples

### TypeScript/Node.js

```typescript
interface PaginationParams {
  limit: number;
  cursor?: string;
  sort?: string[];
  filters?: Record<string, any>;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    has_more: boolean;
    next_cursor: string | null;
    prev_cursor: string | null;
    total?: number;
  };
  links: {
    self: string;
    next: string | null;
    prev: string | null;
  };
}

// Cursor utilities
function encodeCursor(data: Record<string, any>): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function decodeCursor(cursor: string): Record<string, any> {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString());
}

// Pagination service
async function paginateQuery<T>(
  query: QueryBuilder,
  params: PaginationParams,
  buildCursor: (item: T) => Record<string, any>
): Promise<PaginatedResponse<T>> {
  const limit = Math.min(params.limit || 20, 100); // Max 100
  
  // Fetch limit + 1 to determine has_more
  const items = await query.limit(limit + 1).execute();
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  
  return {
    data,
    pagination: {
      limit,
      has_more: hasMore,
      next_cursor: hasMore ? encodeCursor(buildCursor(data[data.length - 1])) : null,
      prev_cursor: params.cursor ? encodeCursor(buildCursor(data[0])) : null,
    },
    links: {
      self: buildLink(params),
      next: hasMore ? buildLink({ ...params, cursor: encodeCursor(buildCursor(data[data.length - 1])) }) : null,
      prev: params.cursor ? buildLink({ ...params, cursor: null }) : null,
    },
  };
}

// Usage in controller
app.get('/api/orders', async (req, res) => {
  const params = parsePaginationParams(req.query);
  
  validateFilters(params.filters, ALLOWED_ORDER_FILTERS);
  validateSort(params.sort, SORTABLE_ORDER_FIELDS);
  
  let query = db('orders').select('*');
  
  // Apply cursor
  if (params.cursor) {
    const { created_at, id } = decodeCursor(params.cursor);
    query = query.where(function() {
      this.where('created_at', '<', created_at)
        .orWhere(function() {
          this.where('created_at', '=', created_at).where('id', '<', id);
        });
    });
  }
  
  // Apply filters
  if (params.filters?.status) {
    query = query.where('status', params.filters.status);
  }
  
  // Apply sort
  query = query.orderBy('created_at', 'desc').orderBy('id', 'desc');
  
  const result = await paginateQuery(query, params, (order) => ({
    created_at: order.created_at,
    id: order.id,
  }));
  
  res.json(result);
});
```

### Python/FastAPI

```python
from typing import TypeVar, Generic, List, Optional, Any
from pydantic import BaseModel
from fastapi import Query
import base64
import json

T = TypeVar('T')

class PaginationMeta(BaseModel):
    limit: int
    has_more: bool
    next_cursor: Optional[str]
    prev_cursor: Optional[str]
    total: Optional[int] = None

class PaginatedResponse(BaseModel, Generic[T]):
    data: List[T]
    pagination: PaginationMeta
    links: dict

def encode_cursor(data: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(data).encode()).decode()

def decode_cursor(cursor: str) -> dict:
    return json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())

ALLOWED_FILTERS = {'status', 'category', 'created_at'}
SORTABLE_FIELDS = {'created_at', 'price', 'name'}

@app.get("/api/products")
async def list_products(
    limit: int = Query(default=20, le=100, ge=1),
    cursor: Optional[str] = None,
    sort: Optional[str] = Query(default="-created_at"),
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    # Validate sort
    sort_fields = sort.split(',') if sort else ['-created_at']
    for field in sort_fields:
        field_name = field.lstrip('-')
        if field_name not in SORTABLE_FIELDS:
            raise HTTPException(400, f"Cannot sort by: {field_name}")
    
    query = db.query(Product)
    
    # Apply cursor
    if cursor:
        cursor_data = decode_cursor(cursor)
        query = query.filter(
            (Product.created_at < cursor_data['created_at']) |
            ((Product.created_at == cursor_data['created_at']) & 
             (Product.id < cursor_data['id']))
        )
    
    # Apply filters
    if status:
        query = query.filter(Product.status == status)
    
    # Apply sort
    query = query.order_by(Product.created_at.desc(), Product.id.desc())
    
    # Fetch limit + 1
    items = query.limit(limit + 1).all()
    has_more = len(items) > limit
    data = items[:limit] if has_more else items
    
    return PaginatedResponse(
        data=data,
        pagination=PaginationMeta(
            limit=limit,
            has_more=has_more,
            next_cursor=encode_cursor({
                'created_at': data[-1].created_at.isoformat(),
                'id': data[-1].id
            }) if has_more and data else None,
            prev_cursor=None,
        ),
        links={...}
    )
```

## References

- [Slack API Pagination](https://api.slack.com/docs/pagination)
- [Stripe API Pagination](https://stripe.com/docs/api/pagination)
- [Zalando RESTful API Guidelines - Pagination](https://opensource.zalando.com/restful-api-guidelines/#pagination)
- [GraphQL Cursor Connections Spec](https://relay.dev/graphql/connections.htm)
- [Use The Index, Luke - Pagination Done Right](https://use-the-index-luke.com/no-offset)
