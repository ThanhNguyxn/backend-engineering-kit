---
id: api-pagination
title: API Pagination Patterns
tags:
  - api
  - pagination
  - performance
  - cursor
  - offset
level: intermediate
stacks:
  - nodejs
  - python
  - go
scope: api
maturity: stable
version: 2.0.0
sources:
  - https://www.moesif.com/blog/technical/api-design/REST-API-Design-Filtering-Sorting-and-Pagination/
  - https://slack.engineering/evolving-api-pagination-at-slack/
  - https://relay.dev/graphql/connections.htm
  - https://developers.facebook.com/docs/graph-api/using-graph-api#paging
---

# API Pagination Patterns

## Problem

Without pagination:
```
GET /api/orders → Returns 1,000,000 orders
                 → 500MB response
                 → 30 second query
                 → OOM on client
                 → OOM on server
```

Large result sets cause:
- Memory exhaustion
- Slow response times
- Network saturation
- Database lock contention
- Poor user experience

## When to use

- **Any** endpoint that returns collections
- Lists that can grow unbounded
- Search results
- Activity feeds
- Admin dashboards

## Solution

### 1. Offset Pagination (Simple)

```typescript
// URL: GET /api/products?page=2&limit=20

interface OffsetPaginationParams {
  page: number;    // 1-indexed
  limit: number;
}

interface OffsetPaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

async function getProductsWithOffset(
  params: OffsetPaginationParams
): Promise<OffsetPaginatedResponse<Product>> {
  const { page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;
  
  // Get total count
  const [{ count }] = await db.query(
    'SELECT COUNT(*) as count FROM products WHERE active = true'
  );
  
  // Get page of results
  const products = await db.query(
    `SELECT * FROM products 
     WHERE active = true 
     ORDER BY created_at DESC 
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  
  const totalItems = parseInt(count, 10);
  const totalPages = Math.ceil(totalItems / limit);
  
  return {
    data: products,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

// Express handler
app.get('/api/products', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  
  const result = await getProductsWithOffset({ page, limit });
  
  // Set pagination headers
  res.setHeader('X-Total-Count', result.pagination.totalItems);
  res.setHeader('X-Total-Pages', result.pagination.totalPages);
  
  // Link header for navigation
  const links = [];
  if (result.pagination.hasNextPage) {
    links.push(`<${req.path}?page=${page + 1}&limit=${limit}>; rel="next"`);
  }
  if (result.pagination.hasPreviousPage) {
    links.push(`<${req.path}?page=${page - 1}&limit=${limit}>; rel="prev"`);
  }
  links.push(`<${req.path}?page=1&limit=${limit}>; rel="first"`);
  links.push(`<${req.path}?page=${result.pagination.totalPages}&limit=${limit}>; rel="last"`);
  res.setHeader('Link', links.join(', '));
  
  res.json(result);
});
```

**Pros:**
- Simple to understand
- Random page access
- Total count available

**Cons:**
- Slow for deep pages (`OFFSET 100000` is slow)
- Inconsistent with concurrent inserts/deletes
- Count query can be expensive

### 2. Cursor Pagination (Recommended)

```typescript
// URL: GET /api/orders?cursor=abc123&limit=20

interface CursorPaginationParams {
  cursor?: string;  // Opaque cursor from previous response
  limit: number;
}

interface CursorPaginatedResponse<T> {
  data: T[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
}

// Cursor encoding (hide implementation details)
function encodeCursor(data: { id: string; createdAt: Date }): string {
  const payload = JSON.stringify({
    id: data.id,
    ts: data.createdAt.toISOString(),
  });
  return Buffer.from(payload).toString('base64url');
}

function decodeCursor(cursor: string): { id: string; createdAt: Date } | null {
  try {
    const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    return {
      id: payload.id,
      createdAt: new Date(payload.ts),
    };
  } catch {
    return null;
  }
}

async function getOrdersWithCursor(
  params: CursorPaginationParams
): Promise<CursorPaginatedResponse<Order>> {
  const { cursor, limit = 20 } = params;
  
  let whereClause = 'WHERE 1=1';
  const queryParams: any[] = [];
  
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) {
      throw new BadRequestError('Invalid cursor');
    }
    
    // Seek method: (created_at, id) < (cursor_ts, cursor_id)
    // Assuming created_at DESC order
    whereClause += ` AND (created_at, id) < ($1, $2)`;
    queryParams.push(decoded.createdAt, decoded.id);
  }
  
  // Fetch limit + 1 to check if there are more results
  const orders = await db.query(
    `SELECT * FROM orders 
     ${whereClause}
     ORDER BY created_at DESC, id DESC
     LIMIT $${queryParams.length + 1}`,
    [...queryParams, limit + 1]
  );
  
  const hasNextPage = orders.length > limit;
  const results = orders.slice(0, limit);
  
  return {
    data: results,
    pageInfo: {
      hasNextPage,
      hasPreviousPage: !!cursor,
      startCursor: results.length > 0 
        ? encodeCursor({ id: results[0].id, createdAt: results[0].createdAt })
        : null,
      endCursor: results.length > 0
        ? encodeCursor({ id: results[results.length - 1].id, createdAt: results[results.length - 1].createdAt })
        : null,
    },
  };
}

// Express handler
app.get('/api/orders', async (req, res) => {
  const cursor = req.query.cursor as string | undefined;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  
  const result = await getOrdersWithCursor({ cursor, limit });
  
  res.json(result);
});
```

**Pros:**
- Consistent pagination (no skipped/duplicate items)
- Fast for any page (uses index seek)
- Works well with real-time data

**Cons:**
- No random page access
- No total count
- Slightly more complex

### 3. Keyset Pagination (Database-Level)

```typescript
// Most efficient for large datasets
// Uses indexed columns for seeking

interface KeysetParams {
  after?: { createdAt: Date; id: string };
  before?: { createdAt: Date; id: string };
  first?: number;
  last?: number;
}

async function getOrdersKeyset(params: KeysetParams): Promise<Order[]> {
  const { after, before, first, last } = params;
  
  // Build query based on direction
  if (first && after) {
    // Forward pagination
    return db.query(
      `SELECT * FROM orders
       WHERE (created_at, id) > ($1, $2)
       ORDER BY created_at ASC, id ASC
       LIMIT $3`,
      [after.createdAt, after.id, first]
    );
  }
  
  if (last && before) {
    // Backward pagination
    const results = await db.query(
      `SELECT * FROM orders
       WHERE (created_at, id) < ($1, $2)
       ORDER BY created_at DESC, id DESC
       LIMIT $3`,
      [before.createdAt, before.id, last]
    );
    return results.reverse();  // Restore original order
  }
  
  // Default: first page
  return db.query(
    `SELECT * FROM orders
     ORDER BY created_at DESC, id DESC
     LIMIT $1`,
    [first || 20]
  );
}

// Create index for efficient keyset pagination
// CREATE INDEX idx_orders_pagination ON orders (created_at DESC, id DESC);
```

### 4. GraphQL Connections (Relay Spec)

```typescript
// Relay-style connections for GraphQL

import { 
  GraphQLObjectType, 
  GraphQLList, 
  GraphQLString, 
  GraphQLBoolean,
  GraphQLInt 
} from 'graphql';

// Edge type
const OrderEdge = new GraphQLObjectType({
  name: 'OrderEdge',
  fields: {
    cursor: { type: GraphQLString },
    node: { type: OrderType },
  },
});

// PageInfo type
const PageInfo = new GraphQLObjectType({
  name: 'PageInfo',
  fields: {
    hasNextPage: { type: GraphQLBoolean },
    hasPreviousPage: { type: GraphQLBoolean },
    startCursor: { type: GraphQLString },
    endCursor: { type: GraphQLString },
  },
});

// Connection type
const OrderConnection = new GraphQLObjectType({
  name: 'OrderConnection',
  fields: {
    edges: { type: new GraphQLList(OrderEdge) },
    pageInfo: { type: PageInfo },
    totalCount: { type: GraphQLInt },  // Optional
  },
});

// Resolver
const resolvers = {
  Query: {
    orders: async (_, { first, after, last, before }) => {
      const orders = await getOrdersWithCursor({
        first,
        after: after ? decodeCursor(after) : undefined,
        last,
        before: before ? decodeCursor(before) : undefined,
      });
      
      return {
        edges: orders.data.map(order => ({
          cursor: encodeCursor({ id: order.id, createdAt: order.createdAt }),
          node: order,
        })),
        pageInfo: orders.pageInfo,
      };
    },
  },
};

// Usage
// query {
//   orders(first: 10, after: "abc123") {
//     edges {
//       cursor
//       node {
//         id
//         total
//       }
//     }
//     pageInfo {
//       hasNextPage
//       endCursor
//     }
//   }
// }
```

### 5. Search Results Pagination

```typescript
// For search with scoring/relevance

interface SearchParams {
  query: string;
  page: number;
  limit: number;
  filters?: Record<string, any>;
  sort?: 'relevance' | 'date' | 'price';
}

interface SearchResult<T> {
  data: Array<T & { score?: number }>;
  pagination: {
    page: number;
    limit: number;
    totalResults: number;
    totalPages: number;
  };
  meta: {
    took: number;  // Query time in ms
    query: string;
    filters: Record<string, any>;
  };
}

async function searchProducts(params: SearchParams): Promise<SearchResult<Product>> {
  const { query, page = 1, limit = 20, filters = {}, sort = 'relevance' } = params;
  const startTime = Date.now();
  
  // Elasticsearch example
  const searchBody: any = {
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query,
              fields: ['name^3', 'description', 'tags^2'],
              fuzziness: 'AUTO',
            },
          },
        ],
        filter: Object.entries(filters).map(([field, value]) => ({
          term: { [field]: value },
        })),
      },
    },
    from: (page - 1) * limit,
    size: limit,
    track_total_hits: true,  // Get accurate total
  };
  
  // Add sorting
  if (sort === 'relevance') {
    // Use default _score
  } else if (sort === 'date') {
    searchBody.sort = [{ created_at: 'desc' }];
  } else if (sort === 'price') {
    searchBody.sort = [{ price: 'asc' }];
  }
  
  const response = await esClient.search({
    index: 'products',
    body: searchBody,
  });
  
  const totalResults = response.hits.total.value;
  
  return {
    data: response.hits.hits.map(hit => ({
      ...hit._source,
      score: hit._score,
    })),
    pagination: {
      page,
      limit,
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
    },
    meta: {
      took: Date.now() - startTime,
      query,
      filters,
    },
  };
}

// Note: For deep pagination in Elasticsearch, use search_after
async function searchDeepPage(params: SearchParams & { searchAfter?: any[] }) {
  const searchBody = {
    // ... query
    size: params.limit,
    sort: [
      { created_at: 'desc' },
      { _id: 'asc' },  // Tiebreaker
    ],
  };
  
  if (params.searchAfter) {
    searchBody.search_after = params.searchAfter;
  }
  
  const response = await esClient.search({
    index: 'products',
    body: searchBody,
  });
  
  const lastHit = response.hits.hits[response.hits.hits.length - 1];
  
  return {
    data: response.hits.hits.map(hit => hit._source),
    nextSearchAfter: lastHit?.sort,  // Use for next page
  };
}
```

### 6. Infinite Scroll / Load More

```typescript
// Client-side implementation for infinite scroll

// API response
interface InfiniteScrollResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

// Server handler
app.get('/api/feed', async (req, res) => {
  const cursor = req.query.cursor as string | undefined;
  const limit = 10;
  
  const items = await getFeedItems({
    cursor: cursor ? decodeCursor(cursor) : undefined,
    limit: limit + 1,
  });
  
  const hasMore = items.length > limit;
  const resultItems = items.slice(0, limit);
  
  const response: InfiniteScrollResponse<FeedItem> = {
    items: resultItems,
    nextCursor: hasMore && resultItems.length > 0
      ? encodeCursor({
          id: resultItems[resultItems.length - 1].id,
          createdAt: resultItems[resultItems.length - 1].createdAt,
        })
      : null,
    hasMore,
  };
  
  res.json(response);
});

// React hook for client
function useInfiniteScroll<T>(
  fetchFn: (cursor?: string) => Promise<InfiniteScrollResponse<T>>
) {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    try {
      const response = await fetchFn(nextCursor || undefined);
      setItems(prev => [...prev, ...response.items]);
      setNextCursor(response.nextCursor);
      setHasMore(response.hasMore);
    } finally {
      setLoading(false);
    }
  }, [nextCursor, hasMore, loading, fetchFn]);
  
  // Initial load
  useEffect(() => {
    loadMore();
  }, []);
  
  return { items, loadMore, hasMore, loading };
}
```

### 7. Batch Export / Streaming

```typescript
// For exporting large datasets

import { Readable } from 'stream';

// Stream large result set
app.get('/api/orders/export', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="orders.json"');
  
  // Stream array start
  res.write('[\n');
  
  let cursor: string | undefined;
  let isFirst = true;
  const batchSize = 1000;
  
  while (true) {
    const batch = await getOrdersBatch({ cursor, limit: batchSize });
    
    for (const order of batch.data) {
      if (!isFirst) {
        res.write(',\n');
      }
      res.write(JSON.stringify(order));
      isFirst = false;
    }
    
    if (!batch.pageInfo.hasNextPage) {
      break;
    }
    
    cursor = batch.pageInfo.endCursor!;
  }
  
  // Stream array end
  res.write('\n]');
  res.end();
});

// CSV streaming
app.get('/api/orders/export.csv', async (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
  
  // Write headers
  res.write('id,customer_email,total,created_at\n');
  
  let cursor: string | undefined;
  
  while (true) {
    const batch = await getOrdersBatch({ cursor, limit: 1000 });
    
    for (const order of batch.data) {
      res.write(`${order.id},${order.customerEmail},${order.total},${order.createdAt}\n`);
    }
    
    if (!batch.pageInfo.hasNextPage) break;
    cursor = batch.pageInfo.endCursor!;
  }
  
  res.end();
});
```

### 8. Total Count Optimization

```typescript
// Avoid expensive COUNT(*) on every request

// Option 1: Cache count
async function getCachedTotalCount(entity: string): Promise<number> {
  const cached = await redis.get(`count:${entity}`);
  if (cached) return parseInt(cached, 10);
  
  const [{ count }] = await db.query(`SELECT COUNT(*) as count FROM ${entity}`);
  await redis.setex(`count:${entity}`, 60, count);  // Cache for 1 minute
  
  return parseInt(count, 10);
}

// Option 2: Approximate count
async function getApproximateCount(table: string): Promise<number> {
  // PostgreSQL-specific: Use statistics
  const [{ estimate }] = await db.query(
    `SELECT reltuples::bigint AS estimate 
     FROM pg_class 
     WHERE relname = $1`,
    [table]
  );
  return parseInt(estimate, 10);
}

// Option 3: Return total only on first page
interface PaginatedResponse<T> {
  data: T[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
    totalCount?: number;  // Only on first page
  };
}

async function getItems(params: {
  cursor?: string;
  limit: number;
  includeTotalCount?: boolean;
}): Promise<PaginatedResponse<Item>> {
  const items = await fetchItems(params.cursor, params.limit);
  
  let totalCount: number | undefined;
  if (params.includeTotalCount && !params.cursor) {
    // Only count on first page, and cache result
    totalCount = await getCachedTotalCount('items');
  }
  
  return {
    data: items,
    pageInfo: {
      hasNextPage: items.length === params.limit,
      endCursor: items.length > 0 ? encodeCursor(items[items.length - 1]) : null,
      totalCount,
    },
  };
}
```

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| No pagination | OOM, slow responses | Always paginate lists |
| No max limit | Client can request all | Set server-side max |
| Offset for large data | Slow queries | Use cursor/keyset |
| COUNT(*) on every request | Database load | Cache or approximate |
| Inconsistent sorting | Duplicates/missing items | Include unique tiebreaker |
| Exposing internal IDs | Information leak | Use opaque cursors |

## Checklist

- [ ] All list endpoints are paginated
- [ ] Maximum limit enforced server-side
- [ ] Default limit is reasonable (10-50)
- [ ] Cursor pagination for large/real-time data
- [ ] Pagination metadata in response
- [ ] Link headers for REST navigation
- [ ] Total count cached or approximate
- [ ] Unique sort tiebreaker (e.g., ID)
- [ ] Streaming for large exports
- [ ] Client library handles pagination

## References

- [Slack: Evolving API Pagination](https://slack.engineering/evolving-api-pagination-at-slack/)
- [Relay Cursor Connections](https://relay.dev/graphql/connections.htm)
- [Facebook Graph API Paging](https://developers.facebook.com/docs/graph-api/using-graph-api#paging)
- [Use the Index, Luke: Pagination](https://use-the-index-luke.com/sql/partial-results/fetch-next-page)
