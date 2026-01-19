---
id: rel-timeouts
title: Timeouts
tags:
  - reliability
  - timeouts
  - resilience
  - latency
  - sla
level: intermediate
stacks:
  - all
scope: reliability
maturity: stable
version: 2.0.0
sources:
  - https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
  - https://sre.google/sre-book/handling-overload/
  - https://docs.microsoft.com/en-us/azure/architecture/patterns/timeout
---

# Timeouts

## Problem

Without proper timeouts, a slow or unresponsive service can block resources indefinitely, causing cascading failures, thread pool exhaustion, and system-wide outages. "Waiting forever" is never acceptable in production.

## When to use

- Any external HTTP calls
- Database queries
- Message queue operations
- Cache operations
- File I/O operations
- Any I/O that could hang

## Solution

### 1. Timeout Types

| Timeout Type | What It Controls | Typical Values |
|--------------|------------------|----------------|
| **Connection** | Time to establish connection | 1-5s |
| **Read/Socket** | Time waiting for data chunks | 5-30s |
| **Request/Total** | End-to-end operation time | 10-60s |
| **Idle** | Time connection sits unused | 60-300s |
| **Pool Checkout** | Time waiting for connection from pool | 1-5s |

### 2. Timeout Hierarchy (Critical!)

```
Client (Browser) → Gateway → Service A → Service B → Database
      60s            50s         30s          15s         5s
      
↓ Direction of shorter timeouts ↓

Rule: Inner services MUST have shorter timeouts than outer services.
Otherwise: Outer service times out, inner continues wasting resources.
```

**Example Hierarchy:**
```yaml
api-gateway:
  timeout: 60s  # Longest

order-service:
  client_timeout: 50s  # Gateway has buffer
  db_timeout: 30s
  cache_timeout: 1s

payment-service:
  client_timeout: 45s
  external_api_timeout: 30s
  db_timeout: 15s

database:
  statement_timeout: 30s
  lock_timeout: 10s
```

### 3. Implementation Examples

**HTTP Client (Node.js with Axios):**
```typescript
import axios from 'axios';
import { AbortController } from 'abort-controller';

const httpClient = axios.create({
  timeout: 10000,  // 10s total request timeout
  // Note: Axios timeout is for entire request, not connection
});

// With AbortController for more control
async function fetchWithTimeout<T>(
  url: string,
  timeoutMs: number = 10000
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await axios.get<T>(url, {
      signal: controller.signal,
    });
    return response.data;
  } catch (error) {
    if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
      throw new TimeoutError(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Database (PostgreSQL):**
```sql
-- Session level
SET statement_timeout = '30s';
SET lock_timeout = '10s';

-- Per query (PostgreSQL 9.3+)
SELECT /*+ statement_timeout(5000) */ * FROM large_table;
```

**Prisma:**
```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_timeout=5&pool_timeout=10',
    },
  },
});

// Per-query timeout
await prisma.$queryRawUnsafe(
  `SET LOCAL statement_timeout = '5s'; SELECT * FROM orders WHERE id = $1`,
  orderId
);
```

**Connection Pool (Generic):**
```typescript
const pool = new Pool({
  connectionTimeoutMillis: 5000,  // Time to establish new connection
  idleTimeoutMillis: 30000,       // Close idle connections after 30s
  query_timeout: 30000,           // Query timeout
  statement_timeout: 30000,       // PostgreSQL statement timeout
});
```

### 4. Timeout Budget Pattern

```typescript
class TimeoutBudget {
  private readonly startTime: number;
  private readonly totalBudget: number;
  
  constructor(totalBudgetMs: number) {
    this.startTime = Date.now();
    this.totalBudget = totalBudgetMs;
  }
  
  remaining(): number {
    return Math.max(0, this.totalBudget - (Date.now() - this.startTime));
  }
  
  isExpired(): boolean {
    return this.remaining() <= 0;
  }
  
  checkExpired(): void {
    if (this.isExpired()) {
      throw new TimeoutError('Request budget exhausted');
    }
  }
}

// Usage
async function processOrder(orderId: string): Promise<Order> {
  const budget = new TimeoutBudget(30000); // 30s total budget
  
  // Step 1: Fetch order (use part of budget)
  budget.checkExpired();
  const order = await fetchWithTimeout(
    `/orders/${orderId}`,
    Math.min(budget.remaining(), 10000)  // Max 10s, or remaining
  );
  
  // Step 2: Validate inventory
  budget.checkExpired();
  await validateInventory(order.items, budget.remaining());
  
  // Step 3: Process payment (with remaining budget)
  budget.checkExpired();
  await processPayment(order, budget.remaining());
  
  return order;
}
```

### 5. Timeout Guidelines by Operation

| Operation | Recommended | Notes |
|-----------|-------------|-------|
| Cache read (Redis) | 100-500ms | Should be fast, fail to source |
| Cache write | 200-1000ms | Slightly more tolerance |
| Internal service call | 1-10s | Depends on operation |
| External API call | 5-30s | Third party SLAs vary |
| Database query (simple) | 1-5s | OLTP queries |
| Database query (complex) | 5-60s | Reports, aggregations |
| File upload | 30s-5min | Depends on size |
| Webhook delivery | 5-30s | Recipient must respond quickly |
| Background job step | 30s-5min | Per step, not total job |

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| No timeout set (infinite wait) | Always configure explicit timeouts |
| Timeout too long | Base on P99 + buffer, not worst case |
| Timeout too aggressive | Allow for realistic response times |
| Inner > outer timeout | Ensure inner < outer for proper cascade |
| Not considering retry budget | Total time = (attempts × timeout) |

## Checklist

- [ ] Connection timeout configured
- [ ] Read/request timeout configured
- [ ] Database query timeout set
- [ ] Message queue operation timeout set
- [ ] Inner timeouts shorter than outer
- [ ] Timeout values documented
- [ ] Timeout errors logged with context
- [ ] Retry budget considers timeout × attempts
- [ ] Circuit breaker monitors timeout rate
- [ ] Timeouts tested in integration tests

## Snippets (Generic)

```
Timeout Layers:
Frontend (30s) → API Gateway (25s) → Service (20s) → Database (5s)

HTTP Client Configuration:
client = HttpClient(
  connect_timeout=5s,
  read_timeout=10s,
  total_timeout=15s
)

Database Configuration:
connection_timeout=5s
query_timeout=30s
pool_checkout_timeout=3s

Timeout Guidelines:
- API calls to external services: 5-30s
- Database queries: 5-60s (depends on query)
- Cache reads: 100-500ms
- Internal microservice calls: 1-10s
- Background job steps: varies (minutes for complex)

Layered Timeout Example:
# Total budget: 25 seconds
# - Initial attempt: 10s timeout
# - First retry: 7s timeout  
# - Second retry: 5s timeout
# - Remaining buffer: 3s

Timeout Error Handling:
try:
  response = http.get(url, timeout=10s)
except TimeoutError:
  log.warn("Request to {url} timed out", context)
  if should_retry:
    return retry_with_backoff()
  else:
    raise ServiceUnavailable()
```

## Sources

- AWS Best Practices for Timeouts: https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- Netflix Hystrix Wiki: https://github.com/Netflix/Hystrix/wiki
- Google SRE Book - Handling Overload: https://sre.google/sre-book/handling-overload/
- Release It! (Michael Nygard): https://pragprog.com/titles/mnee2/release-it-second-edition/
