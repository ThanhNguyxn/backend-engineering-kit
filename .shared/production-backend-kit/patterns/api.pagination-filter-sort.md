---
title: API Pagination, Filter & Sort
description: RESTful pagination, filtering, and sorting best practices
category: patterns
tags:
  - api
  - pagination
  - filtering
  - sorting
  - rest
version: 1.0.0
---

# API Pagination, Filter & Sort

## Overview

Efficient data retrieval requires proper pagination, filtering, and sorting. This pattern covers both cursor-based and offset-based approaches.

## Pagination Types

### Offset-Based Pagination

Best for: Small datasets, admin interfaces, traditional table views.

**Request:**
```
GET /api/users?page=2&per_page=20
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "per_page": 20,
    "total": 150,
    "total_pages": 8,
    "has_more": true
  }
}
```

### Cursor-Based Pagination

Best for: Real-time data, infinite scroll, large datasets.

**Request:**
```
GET /api/posts?limit=20&cursor=eyJpZCI6MTAwfQ==
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "next_cursor": "eyJpZCI6MTIwfQ==",
    "has_more": true
  }
}
```

## Pagination Comparison

| Criteria | Offset-Based | Cursor-Based |
|----------|--------------|--------------|
| Random access | ✅ Yes | ❌ No |
| Consistent with inserts | ❌ No | ✅ Yes |
| Performance (large data) | ❌ Slow | ✅ Fast |
| Total count | ✅ Easy | ❌ Expensive |
| Implementation | ✅ Simple | ⚠️ Complex |

## Filtering

### Query Parameter Format

```
GET /api/products?category=electronics&price_min=100&price_max=500&in_stock=true
```

### Advanced Filtering

Support operators for complex queries:

```
GET /api/products?filter[price][gte]=100&filter[price][lte]=500
GET /api/products?filter[name][contains]=phone
GET /api/products?filter[created_at][after]=2026-01-01
```

### Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equals | `filter[status][eq]=active` |
| `ne` | Not equals | `filter[status][ne]=deleted` |
| `gt` | Greater than | `filter[price][gt]=100` |
| `gte` | Greater than or equal | `filter[price][gte]=100` |
| `lt` | Less than | `filter[price][lt]=500` |
| `lte` | Less than or equal | `filter[price][lte]=500` |
| `in` | In array | `filter[status][in]=active,pending` |
| `contains` | Contains substring | `filter[name][contains]=phone` |

## Sorting

### Single Field Sort

```
GET /api/users?sort=created_at
GET /api/users?sort=-created_at  # Descending (prefix with -)
```

### Multi-Field Sort

```
GET /api/users?sort=-created_at,name
GET /api/users?sort[]=created_at:desc&sort[]=name:asc
```

## Complete Response Structure

```json
{
  "data": [
    {
      "id": "usr_123",
      "name": "John Doe",
      "email": "john@example.com",
      "created_at": "2026-01-14T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8,
    "has_more": true
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-01-14T12:00:00Z",
    "filters_applied": {
      "status": "active"
    },
    "sort_applied": "-created_at"
  },
  "links": {
    "self": "/api/users?page=1&per_page=20",
    "first": "/api/users?page=1&per_page=20",
    "prev": null,
    "next": "/api/users?page=2&per_page=20",
    "last": "/api/users?page=8&per_page=20"
  }
}
```

## Implementation Examples

### TypeScript (Express)

```typescript
interface PaginationParams {
  page: number;
  perPage: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
}

function parsePaginationParams(query: any): PaginationParams {
  return {
    page: Math.max(1, parseInt(query.page) || 1),
    perPage: Math.min(100, Math.max(1, parseInt(query.per_page) || 20)),
    sortBy: query.sort?.replace(/^-/, ''),
    sortOrder: query.sort?.startsWith('-') ? 'desc' : 'asc',
  };
}

async function paginate<T>(
  queryBuilder: any,
  params: PaginationParams
): Promise<PaginatedResponse<T>> {
  const total = await queryBuilder.clone().count();
  const offset = (params.page - 1) * params.perPage;
  
  const data = await queryBuilder
    .orderBy(params.sortBy, params.sortOrder)
    .limit(params.perPage)
    .offset(offset);

  return {
    data,
    pagination: {
      page: params.page,
      per_page: params.perPage,
      total,
      total_pages: Math.ceil(total / params.perPage),
      has_more: params.page * params.perPage < total,
    },
  };
}
```

### Python (FastAPI)

```python
from typing import Generic, TypeVar, Optional
from pydantic import BaseModel
from fastapi import Query

T = TypeVar('T')

class PaginationParams(BaseModel):
    page: int = 1
    per_page: int = 20
    sort_by: Optional[str] = None
    sort_order: str = "asc"

class PaginatedResponse(BaseModel, Generic[T]):
    data: list[T]
    pagination: dict

def get_pagination_params(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    sort: Optional[str] = Query(None),
) -> PaginationParams:
    sort_order = "desc" if sort and sort.startswith("-") else "asc"
    sort_by = sort.lstrip("-") if sort else None
    
    return PaginationParams(
        page=page,
        per_page=per_page,
        sort_by=sort_by,
        sort_order=sort_order,
    )
```

## Best Practices

1. **Set maximum page size** - Prevent abuse (e.g., max 100 items)
2. **Default to sensible limits** - Use 20-25 items per page
3. **Include total count wisely** - Can be expensive for large datasets
4. **Use cursor pagination for real-time** - Prevents duplicate/missing items
5. **Document all filter operators** - Make API discoverable
6. **Validate sort fields** - Only allow sorting on indexed columns
7. **Return HATEOAS links** - Help clients navigate

## Anti-Patterns

❌ **Don't allow unlimited page sizes**
```
GET /api/users?per_page=999999  # Can crash server
```

❌ **Don't use offset for real-time data**
```
# New inserts shift results, causing duplicates/gaps
```

❌ **Don't filter on non-indexed fields**
```
# Full table scan on every request
```

## Related Patterns

- [API Error Model](./api.error-model.md)
