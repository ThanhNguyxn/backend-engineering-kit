---
id: rel-timeout-strategies
title: Timeout Strategies and Deadline Propagation
tags:
  - reliability
  - timeout
  - deadline
  - resilience
  - latency
level: intermediate
stacks:
  - nodejs
  - python
  - go
scope: reliability
maturity: stable
version: 2.0.0
sources:
  - https://sre.google/sre-book/addressing-cascading-failures/
  - https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
  - https://grpc.io/docs/guides/deadlines/
  - https://docs.microsoft.com/en-us/azure/architecture/patterns/timeout
---

# Timeout Strategies and Deadline Propagation

## Problem

Without proper timeouts:
```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Client  │───▶│ API     │───▶│ Service │───▶│   DB    │
│         │    │ Gateway │    │    A    │    │  (hung) │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │
     │ waiting...   │ waiting...   │ waiting...   │ stuck!
     │ 30s default  │ 30s default  │ 30s default  │
     ▼              ▼              ▼              ▼
   User gives up    Thread blocked  Thread blocked  
   (bad UX)        (exhausted pool) (exhausted pool)
```

- Resources held indefinitely
- Thread/connection pool exhaustion
- Cascading failures
- User waiting with no feedback

## When to use

- **Every** external call (HTTP, DB, cache, queue)
- Internal service-to-service calls
- Any I/O operation
- Background job processing
- User-facing request handlers

## Solution

### 1. Timeout Hierarchy

```typescript
/**
 * Timeout hierarchy (from outer to inner):
 * 
 * 1. Request timeout (30s) - Total time for entire request
 *    └── 2. Service call timeout (10s) - Call to downstream service
 *        └── 3. Connection timeout (5s) - Establishing connection
 *            └── 4. Socket timeout (30s) - Idle socket
 * 
 * Each inner timeout should be less than its parent
 */

interface TimeoutConfig {
  // HTTP client timeouts
  http: {
    connect: number;    // Time to establish connection
    socket: number;     // Time between data packets
    request: number;    // Total request time
  };
  
  // Database timeouts
  db: {
    connect: number;    // Connection acquisition
    query: number;      // Query execution
    transaction: number; // Transaction duration
  };
  
  // Cache timeouts
  cache: {
    connect: number;
    operation: number;
  };
  
  // Request-level
  request: {
    total: number;      // Total request processing time
    graceful: number;   // Time for graceful shutdown
  };
}

const timeoutConfig: TimeoutConfig = {
  http: {
    connect: 5000,      // 5s to connect
    socket: 30000,      // 30s idle
    request: 10000,     // 10s total for downstream calls
  },
  db: {
    connect: 5000,      // 5s to get connection
    query: 10000,       // 10s query timeout
    transaction: 30000, // 30s transaction timeout
  },
  cache: {
    connect: 1000,      // 1s to connect
    operation: 500,     // 500ms per operation
  },
  request: {
    total: 30000,       // 30s for entire request
    graceful: 10000,    // 10s for graceful shutdown
  },
};
```

### 2. HTTP Client with Timeouts

```typescript
import axios, { AxiosInstance } from 'axios';

function createHttpClient(config: {
  baseURL: string;
  timeout?: number;
  connectTimeout?: number;
}): AxiosInstance {
  const client = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout || 10000,
    
    // Per-request timeout
    signal: AbortSignal.timeout(config.timeout || 10000),
  });

  // Connection timeout via custom agent
  const http = require('http');
  const https = require('https');
  
  const agentOptions = {
    timeout: config.connectTimeout || 5000,
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 100,
    maxFreeSockets: 10,
  };
  
  client.defaults.httpAgent = new http.Agent(agentOptions);
  client.defaults.httpsAgent = new https.Agent(agentOptions);

  // Add request timing
  client.interceptors.request.use((config) => {
    config.metadata = { startTime: Date.now() };
    return config;
  });

  client.interceptors.response.use(
    (response) => {
      const duration = Date.now() - response.config.metadata.startTime;
      metrics.histogram('http.client.duration', duration, {
        host: new URL(response.config.url!).hostname,
        status: String(response.status),
      });
      return response;
    },
    (error) => {
      if (axios.isCancel(error) || error.code === 'ECONNABORTED') {
        metrics.increment('http.client.timeout');
        throw new TimeoutError(`Request timeout: ${error.config?.url}`);
      }
      throw error;
    }
  );

  return client;
}

// Usage with per-request timeout
const userService = createHttpClient({
  baseURL: 'http://user-service',
  timeout: 5000,
});

async function getUser(id: string, deadline?: number) {
  const timeout = deadline || 5000;
  
  const response = await userService.get(`/users/${id}`, {
    timeout,
    signal: AbortSignal.timeout(timeout),
  });
  
  return response.data;
}
```

### 3. Deadline Propagation

```typescript
import { AsyncLocalStorage } from 'async_hooks';

interface RequestDeadline {
  deadline: number;      // Absolute timestamp when request must complete
  remaining(): number;   // Remaining time in ms
  isExpired(): boolean;
  getChildDeadline(maxTime: number): number;  // For downstream calls
}

const deadlineStorage = new AsyncLocalStorage<RequestDeadline>();

class Deadline implements RequestDeadline {
  constructor(public deadline: number) {}
  
  remaining(): number {
    return Math.max(0, this.deadline - Date.now());
  }
  
  isExpired(): boolean {
    return Date.now() >= this.deadline;
  }
  
  getChildDeadline(maxTime: number): number {
    // Child deadline is min of remaining time and maxTime
    // Leave buffer for processing response
    const buffer = 100;  // 100ms buffer
    return Math.min(this.remaining() - buffer, maxTime);
  }
}

// Middleware to set deadline
export function deadlineMiddleware(maxRequestTime: number = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check for propagated deadline header
    const deadlineHeader = req.get('X-Deadline');
    let deadline: number;
    
    if (deadlineHeader) {
      deadline = parseInt(deadlineHeader, 10);
      // Don't accept deadlines beyond our max
      deadline = Math.min(deadline, Date.now() + maxRequestTime);
    } else {
      deadline = Date.now() + maxRequestTime;
    }
    
    const requestDeadline = new Deadline(deadline);
    
    // Set timeout for response
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          error: 'Request timeout',
          code: 'DEADLINE_EXCEEDED',
        });
      }
    }, requestDeadline.remaining());
    
    res.on('finish', () => clearTimeout(timeoutId));
    
    deadlineStorage.run(requestDeadline, () => next());
  };
}

// Get current deadline
export function getDeadline(): RequestDeadline | undefined {
  return deadlineStorage.getStore();
}

// Helper to check deadline before expensive operations
export function checkDeadline(): void {
  const deadline = getDeadline();
  if (deadline?.isExpired()) {
    throw new DeadlineExceededError('Request deadline exceeded');
  }
}

// Propagate deadline to downstream service
export async function callDownstream<T>(
  fn: (timeout: number) => Promise<T>,
  maxTime: number
): Promise<T> {
  const deadline = getDeadline();
  const timeout = deadline?.getChildDeadline(maxTime) ?? maxTime;
  
  if (timeout <= 0) {
    throw new DeadlineExceededError('Insufficient time remaining');
  }
  
  return fn(timeout);
}

// Usage
app.get('/api/orders/:id', deadlineMiddleware(30000), async (req, res) => {
  const orderId = req.params.id;
  
  // Check deadline before starting
  checkDeadline();
  
  // Call user service with propagated deadline
  const user = await callDownstream(
    (timeout) => userService.get(`/users/${req.user.id}`, {
      timeout,
      headers: {
        'X-Deadline': String(getDeadline()!.deadline),
      },
    }),
    5000
  );
  
  checkDeadline();
  
  // Call order service
  const order = await callDownstream(
    (timeout) => orderService.get(`/orders/${orderId}`, {
      timeout,
      headers: {
        'X-Deadline': String(getDeadline()!.deadline),
      },
    }),
    5000
  );
  
  res.json({ order, user: user.data });
});
```

### 4. Database Query Timeouts

```typescript
import { Pool, PoolConfig } from 'pg';

// PostgreSQL with timeouts
const poolConfig: PoolConfig = {
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  
  // Connection timeout
  connectionTimeoutMillis: 5000,
  
  // Query timeout (default for all queries)
  statement_timeout: 10000,
  
  // Idle in transaction timeout
  idle_in_transaction_session_timeout: 30000,
  
  // Lock timeout
  lock_timeout: 5000,
};

const pool = new Pool(poolConfig);

// Query with specific timeout
async function queryWithTimeout<T>(
  sql: string,
  params: any[],
  timeout: number
): Promise<T[]> {
  const client = await pool.connect();
  
  try {
    // Set statement timeout for this session
    await client.query(`SET statement_timeout = ${timeout}`);
    
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    // Reset timeout
    await client.query('RESET statement_timeout');
    client.release();
  }
}

// Transaction with timeout
async function transactionWithTimeout<T>(
  fn: (client: PoolClient) => Promise<T>,
  timeout: number
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout = ${timeout}`);
    await client.query(`SET LOCAL lock_timeout = ${Math.floor(timeout / 2)}`);
    
    const result = await fn(client);
    
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// With deadline propagation
async function queryWithDeadline<T>(sql: string, params: any[]): Promise<T[]> {
  const deadline = getDeadline();
  const timeout = deadline?.remaining() ?? 10000;
  
  if (timeout < 100) {
    throw new DeadlineExceededError('Insufficient time for database query');
  }
  
  return queryWithTimeout(sql, params, timeout - 100);  // 100ms buffer
}
```

### 5. Promise Timeout Wrapper

```typescript
// Generic timeout wrapper for any promise

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeout: number,
  operation: string = 'Operation'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(`${operation} timed out after ${timeout}ms`));
    }, timeout);
  });
  
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

// With AbortController for cancellation
async function withTimeoutAndCancel<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeout: number,
  operation: string = 'Operation'
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    return await fn(controller.signal);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new TimeoutError(`${operation} timed out after ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Usage
const result = await withTimeout(
  expensiveOperation(),
  5000,
  'Expensive operation'
);

const data = await withTimeoutAndCancel(
  async (signal) => {
    const response = await fetch(url, { signal });
    return response.json();
  },
  5000,
  'API call'
);
```

### 6. Timeout with Fallback

```typescript
// Return fallback value on timeout instead of throwing

async function withFallback<T>(
  fn: () => Promise<T>,
  timeout: number,
  fallback: T | (() => T),
  options: {
    logTimeout?: boolean;
    operation?: string;
  } = {}
): Promise<T> {
  try {
    return await withTimeout(fn(), timeout, options.operation);
  } catch (error) {
    if (error instanceof TimeoutError) {
      if (options.logTimeout) {
        logger.warn({
          operation: options.operation,
          timeout,
        }, 'Operation timed out, using fallback');
      }
      
      return typeof fallback === 'function' ? (fallback as () => T)() : fallback;
    }
    throw error;
  }
}

// Usage for non-critical operations
const recommendations = await withFallback(
  () => recommendationService.getForUser(userId),
  500,  // 500ms timeout
  [],   // Return empty array on timeout
  { logTimeout: true, operation: 'getRecommendations' }
);

// Cached fallback
const userProfile = await withFallback(
  () => userService.getProfile(userId),
  1000,
  () => cache.get(`user:${userId}`) || DEFAULT_PROFILE,
  { logTimeout: true, operation: 'getUserProfile' }
);
```

### 7. Timeout Configuration by Environment

```typescript
// Different timeouts for different environments

interface TimeoutProfile {
  http: { connect: number; request: number };
  db: { query: number; transaction: number };
  cache: { operation: number };
  request: { total: number };
}

const timeoutProfiles: Record<string, TimeoutProfile> = {
  development: {
    http: { connect: 10000, request: 30000 },
    db: { query: 30000, transaction: 60000 },
    cache: { operation: 5000 },
    request: { total: 120000 },  // Long timeouts for debugging
  },
  
  staging: {
    http: { connect: 5000, request: 15000 },
    db: { query: 15000, transaction: 45000 },
    cache: { operation: 1000 },
    request: { total: 60000 },
  },
  
  production: {
    http: { connect: 3000, request: 10000 },
    db: { query: 10000, transaction: 30000 },
    cache: { operation: 500 },
    request: { total: 30000 },  // Strict timeouts
  },
};

const env = process.env.NODE_ENV || 'development';
export const timeouts = timeoutProfiles[env] || timeoutProfiles.production;
```

### 8. Monitoring Timeout Metrics

```typescript
// Track timeout occurrences and near-misses

class TimeoutMonitor {
  private thresholds = {
    warning: 0.8,  // Warn at 80% of timeout
    critical: 0.95, // Critical at 95%
  };

  wrapWithMonitoring<T>(
    fn: () => Promise<T>,
    timeout: number,
    operation: string
  ): Promise<T> {
    const startTime = Date.now();
    
    return fn()
      .then(result => {
        const duration = Date.now() - startTime;
        this.recordDuration(operation, duration, timeout, 'success');
        return result;
      })
      .catch(error => {
        const duration = Date.now() - startTime;
        const status = error instanceof TimeoutError ? 'timeout' : 'error';
        this.recordDuration(operation, duration, timeout, status);
        throw error;
      });
  }

  private recordDuration(
    operation: string,
    duration: number,
    timeout: number,
    status: string
  ) {
    const ratio = duration / timeout;
    
    // Record metrics
    metrics.histogram(`operation.duration`, duration, { operation, status });
    metrics.gauge(`operation.timeout_ratio`, ratio, { operation });
    
    // Alert on near-misses
    if (status === 'success') {
      if (ratio >= this.thresholds.critical) {
        logger.warn({
          operation,
          duration,
          timeout,
          ratio,
        }, 'Operation nearly timed out');
      } else if (ratio >= this.thresholds.warning) {
        logger.info({
          operation,
          duration,
          timeout,
          ratio,
        }, 'Operation approaching timeout threshold');
      }
    }
    
    // Track timeout rate
    if (status === 'timeout') {
      metrics.increment('operation.timeout', { operation });
    }
  }
}

// Usage
const monitor = new TimeoutMonitor();

const result = await monitor.wrapWithMonitoring(
  () => userService.getUser(id),
  5000,
  'getUser'
);
```

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| No timeout | Resource exhaustion | Always set timeouts |
| Timeout too long | Slow failure, bad UX | Match business requirements |
| Timeout too short | False failures | Test under load |
| No deadline propagation | Wasted work downstream | Propagate via headers |
| Ignoring remaining time | Waste resources | Check deadline before operations |
| Same timeout everywhere | Suboptimal | Tune per operation |
| No fallback strategy | All-or-nothing | Implement graceful degradation |

## Checklist

- [ ] Connection timeout set for all clients
- [ ] Request timeout set for all HTTP calls
- [ ] Database query timeout configured
- [ ] Deadline propagation implemented
- [ ] Timeout varies by operation criticality
- [ ] Metrics track timeout rate and near-misses
- [ ] Fallback strategy for non-critical operations
- [ ] Different timeouts per environment
- [ ] Child timeouts less than parent
- [ ] Buffer time for response processing

## References

- [Google SRE: Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/)
- [AWS: Timeouts, Retries, and Backoff](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
- [gRPC Deadlines](https://grpc.io/docs/guides/deadlines/)
- [Azure Timeout Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/timeout)
