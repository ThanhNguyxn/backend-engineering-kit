---
id: rel-bulkhead-pattern
title: Bulkhead Pattern
tags:
  - reliability
  - bulkhead
  - isolation
  - fault-tolerance
  - resilience
level: intermediate
stacks:
  - all
scope: reliability
maturity: stable
version: 2.0.0
sources:
  - https://docs.microsoft.com/en-us/azure/architecture/patterns/bulkhead
  - https://resilience4j.readme.io/docs/bulkhead
  - https://martinfowler.com/bliki/CircuitBreaker.html
  - https://aws.amazon.com/builders-library/avoiding-overload-in-distributed-systems/
---

# Bulkhead Pattern

## Problem

Without isolation, a failure in one part of the system cascades everywhere:
- Slow downstream service exhausts all threads
- Memory leak in one feature crashes entire app
- Runaway query blocks all database connections
- One noisy tenant degrades service for everyone
- Single misbehaving endpoint takes down API

**Named after ship bulkheads that contain flooding to one compartment.**

## When to use

- Multiple downstream dependencies with varying reliability
- Multi-tenant systems requiring isolation
- Critical features that must remain available
- Background jobs competing with real-time requests
- Rate-limited external APIs
- Workloads with different latency requirements

## Solution

### 1. Bulkhead Types

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BULKHEAD STRATEGIES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  THREAD POOL    │  │   SEMAPHORE     │  │  CONNECTION     │             │
│  │   ISOLATION     │  │   ISOLATION     │  │    POOL         │             │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤             │
│  │ Dedicated       │  │ Limit concurrent│  │ Separate pools  │             │
│  │ threads per     │  │ calls with      │  │ per service/    │             │
│  │ operation type  │  │ counting        │  │ tenant          │             │
│  │                 │  │ semaphore       │  │                 │             │
│  │ Pros:           │  │ Pros:           │  │ Pros:           │             │
│  │ - Full isolation│  │ - Lightweight   │  │ - DB isolation  │             │
│  │ - Timeout ctrl  │  │ - Less overhead │  │ - Prevents      │             │
│  │                 │  │ - No thread     │  │   monopolization│             │
│  │ Cons:           │  │   management    │  │                 │             │
│  │ - More resources│  │ Cons:           │  │ Cons:           │             │
│  │ - Complex       │  │ - Shared thread │  │ - More          │             │
│  │                 │  │   pool risks    │  │   connections   │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  PROCESS        │  │   QUEUE         │  │  RESOURCE       │             │
│  │  ISOLATION      │  │   ISOLATION     │  │    QUOTAS       │             │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤             │
│  │ Separate        │  │ Separate queues │  │ Per-tenant/     │             │
│  │ processes per   │  │ per priority/   │  │ per-endpoint    │             │
│  │ workload        │  │ type            │  │ resource limits │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Semaphore Bulkhead (TypeScript)

```typescript
// Simple semaphore-based bulkhead
class Bulkhead {
  private currentCalls = 0;
  private waitQueue: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];
  
  constructor(
    private readonly name: string,
    private readonly maxConcurrent: number,
    private readonly maxWait: number = 100, // Max queue size
    private readonly timeout: number = 30000, // Wait timeout
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Try to acquire
    if (this.currentCalls < this.maxConcurrent) {
      return this.runWithPermit(fn);
    }

    // Queue if room
    if (this.waitQueue.length < this.maxWait) {
      await this.waitForPermit();
      return this.runWithPermit(fn);
    }

    // Reject immediately - bulkhead full
    metrics.increment('bulkhead.rejected', { name: this.name });
    throw new BulkheadFullError(
      `Bulkhead ${this.name} is full (${this.maxConcurrent} concurrent, ${this.maxWait} queued)`
    );
  }

  private async runWithPermit<T>(fn: () => Promise<T>): Promise<T> {
    this.currentCalls++;
    metrics.gauge('bulkhead.concurrent', this.currentCalls, { name: this.name });
    
    try {
      return await fn();
    } finally {
      this.currentCalls--;
      this.releaseWaiter();
    }
  }

  private waitForPermit(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waitQueue.findIndex(w => w.resolve === resolve);
        if (idx >= 0) this.waitQueue.splice(idx, 1);
        reject(new BulkheadTimeoutError(`Timeout waiting for bulkhead ${this.name}`));
      }, this.timeout);

      this.waitQueue.push({
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject,
      });
      
      metrics.gauge('bulkhead.queued', this.waitQueue.length, { name: this.name });
    });
  }

  private releaseWaiter() {
    const waiter = this.waitQueue.shift();
    if (waiter) {
      waiter.resolve();
    }
  }
}

// Usage
const paymentBulkhead = new Bulkhead('payment-service', 10, 50);
const inventoryBulkhead = new Bulkhead('inventory-service', 20, 100);

async function processOrder(order: Order) {
  // Each downstream call is isolated
  const [payment, inventory] = await Promise.all([
    paymentBulkhead.execute(() => paymentService.charge(order)),
    inventoryBulkhead.execute(() => inventoryService.reserve(order)),
  ]);
  
  // If payment service is slow and exhausts its bulkhead,
  // inventory service calls are unaffected
  return { payment, inventory };
}
```

### 3. Resilience4j-style Bulkhead (TypeScript)

```typescript
import Bottleneck from 'bottleneck';

// Bottleneck provides robust bulkhead/rate limiting
const bulkheads = {
  // Payment: max 10 concurrent, max 50 queued
  payment: new Bottleneck({
    maxConcurrent: 10,
    reservoir: 50,      // Max queued
    reservoirRefreshInterval: 1000,
    reservoirRefreshAmount: 50,
  }),
  
  // External API: max 5 concurrent, 100ms between calls
  externalApi: new Bottleneck({
    maxConcurrent: 5,
    minTime: 100,       // Minimum time between calls
  }),
  
  // Heavy computation: max 2 concurrent
  heavyCompute: new Bottleneck({
    maxConcurrent: 2,
  }),
};

// Wrap calls with bulkhead
const chargePayment = bulkheads.payment.wrap(async (order: Order) => {
  return paymentService.charge(order);
});

// With events
bulkheads.payment.on('failed', (error, jobInfo) => {
  logger.error({ error, jobInfo }, 'Payment bulkhead job failed');
});

bulkheads.payment.on('dropped', (dropped) => {
  metrics.increment('bulkhead.dropped', { service: 'payment' });
  logger.warn({ dropped }, 'Payment request dropped by bulkhead');
});
```

### 4. Connection Pool Bulkheads

```typescript
// Separate connection pools per service/tenant
import { Pool } from 'pg';

class DatabaseBulkhead {
  private pools: Map<string, Pool> = new Map();
  
  constructor(
    private baseConfig: PoolConfig,
    private poolSizes: Record<string, number>,
  ) {}

  getPool(identifier: string): Pool {
    if (!this.pools.has(identifier)) {
      const size = this.poolSizes[identifier] || this.poolSizes.default || 5;
      
      this.pools.set(identifier, new Pool({
        ...this.baseConfig,
        max: size,
        // Separate pool name for metrics
        application_name: `app-${identifier}`,
      }));
    }
    
    return this.pools.get(identifier)!;
  }
}

// Configuration
const dbBulkhead = new DatabaseBulkhead(
  { host: 'localhost', database: 'mydb' },
  {
    default: 5,
    'api-critical': 10,     // More connections for critical path
    'api-reports': 3,       // Limited for heavy reports
    'background-jobs': 5,   // Isolated from API
    'tenant-enterprise': 8, // Premium tenant gets more
    'tenant-free': 2,       // Free tier limited
  }
);

// Usage - requests from different sources use isolated pools
async function handleApiRequest(req: Request) {
  const pool = dbBulkhead.getPool('api-critical');
  return pool.query('SELECT ...');
}

async function generateReport(req: Request) {
  const pool = dbBulkhead.getPool('api-reports');
  return pool.query('SELECT ... (heavy aggregation)');
}

async function processBackgroundJob(job: Job) {
  const pool = dbBulkhead.getPool('background-jobs');
  return pool.query('UPDATE ...');
}

// Tenant-based isolation
async function handleTenantRequest(req: Request) {
  const tier = req.tenant.plan; // 'enterprise' or 'free'
  const pool = dbBulkhead.getPool(`tenant-${tier}`);
  return pool.query('SELECT ... WHERE tenant_id = $1', [req.tenant.id]);
}
```

### 5. HTTP Client Bulkheads

```typescript
import axios, { AxiosInstance } from 'axios';
import { Agent } from 'http';

// Separate HTTP agents per downstream service
function createBulkheadedClient(
  name: string,
  baseURL: string,
  maxSockets: number,
): AxiosInstance {
  // Each client has its own connection pool
  const agent = new Agent({
    maxSockets,           // Max concurrent connections
    maxFreeSockets: 10,   // Keep-alive connections
    timeout: 30000,
    keepAlive: true,
  });

  const client = axios.create({
    baseURL,
    httpAgent: agent,
    timeout: 10000,
  });

  // Track metrics
  client.interceptors.request.use((config) => {
    metrics.increment('http.request', { service: name });
    return config;
  });

  client.interceptors.response.use(
    (response) => {
      metrics.increment('http.response', { 
        service: name, 
        status: response.status,
      });
      return response;
    },
    (error) => {
      metrics.increment('http.error', { service: name });
      throw error;
    }
  );

  return client;
}

// Create isolated clients
const httpClients = {
  payment: createBulkheadedClient('payment', 'https://payment.internal', 10),
  inventory: createBulkheadedClient('inventory', 'https://inventory.internal', 20),
  shipping: createBulkheadedClient('shipping', 'https://shipping.internal', 15),
  // External API with strict limits
  externalApi: createBulkheadedClient('external', 'https://api.external.com', 5),
};
```

### 6. Worker Thread Bulkheads (CPU-bound)

```typescript
import { Worker } from 'worker_threads';
import { cpus } from 'os';

class WorkerPoolBulkhead {
  private workers: Worker[] = [];
  private taskQueue: Array<{
    task: any;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  private busyWorkers = new Set<Worker>();

  constructor(
    private workerPath: string,
    private poolSize: number = Math.max(1, cpus().length - 1),
  ) {
    this.initializeWorkers();
  }

  private initializeWorkers() {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(this.workerPath);
      
      worker.on('message', (result) => {
        this.busyWorkers.delete(worker);
        this.processQueue();
        // Result handling done via Promise
      });
      
      worker.on('error', (error) => {
        this.busyWorkers.delete(worker);
        // Replace crashed worker
        this.workers = this.workers.filter(w => w !== worker);
        this.workers.push(new Worker(this.workerPath));
      });
      
      this.workers.push(worker);
    }
  }

  async execute<T>(task: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const availableWorker = this.workers.find(w => !this.busyWorkers.has(w));
      
      if (availableWorker) {
        this.runOnWorker(availableWorker, task, resolve, reject);
      } else {
        // Queue the task
        this.taskQueue.push({ task, resolve, reject });
        metrics.gauge('worker_bulkhead.queued', this.taskQueue.length);
      }
    });
  }

  private runOnWorker(
    worker: Worker,
    task: any,
    resolve: (value: any) => void,
    reject: (error: any) => void,
  ) {
    this.busyWorkers.add(worker);
    
    const messageHandler = (result: any) => {
      worker.off('message', messageHandler);
      worker.off('error', errorHandler);
      resolve(result);
    };
    
    const errorHandler = (error: any) => {
      worker.off('message', messageHandler);
      worker.off('error', errorHandler);
      reject(error);
    };
    
    worker.on('message', messageHandler);
    worker.on('error', errorHandler);
    worker.postMessage(task);
  }

  private processQueue() {
    if (this.taskQueue.length === 0) return;
    
    const availableWorker = this.workers.find(w => !this.busyWorkers.has(w));
    if (!availableWorker) return;
    
    const { task, resolve, reject } = this.taskQueue.shift()!;
    this.runOnWorker(availableWorker, task, resolve, reject);
  }
}

// Usage - isolate CPU-heavy operations
const imageProcessingPool = new WorkerPoolBulkhead('./image-worker.js', 2);
const pdfGenerationPool = new WorkerPoolBulkhead('./pdf-worker.js', 2);

// These won't block each other or the main thread
await Promise.all([
  imageProcessingPool.execute({ type: 'resize', image: buffer }),
  pdfGenerationPool.execute({ type: 'generate', data: reportData }),
]);
```

### 7. Queue-Based Bulkheads

```typescript
import Bull from 'bull';

// Separate queues for different priority levels
const queues = {
  critical: new Bull('critical-jobs', {
    redis: { host: 'redis' },
    limiter: {
      max: 100,        // Max concurrent
      duration: 1000,  // Per second
    },
  }),
  
  standard: new Bull('standard-jobs', {
    redis: { host: 'redis' },
    limiter: {
      max: 50,
      duration: 1000,
    },
  }),
  
  batch: new Bull('batch-jobs', {
    redis: { host: 'redis' },
    limiter: {
      max: 10,         // Limited - don't overwhelm system
      duration: 1000,
    },
  }),
};

// Process with isolated concurrency
queues.critical.process(20, async (job) => {
  // Up to 20 concurrent critical jobs
  return processCriticalJob(job.data);
});

queues.standard.process(10, async (job) => {
  // Up to 10 concurrent standard jobs
  return processStandardJob(job.data);
});

queues.batch.process(2, async (job) => {
  // Only 2 concurrent batch jobs
  return processBatchJob(job.data);
});

// Route jobs to appropriate queue
function enqueueJob(job: Job) {
  switch (job.priority) {
    case 'critical':
      return queues.critical.add(job.data, { priority: 1 });
    case 'batch':
      return queues.batch.add(job.data);
    default:
      return queues.standard.add(job.data);
  }
}
```

### 8. Multi-Tenant Bulkheads

```typescript
// Isolate tenants to prevent noisy neighbor
class TenantBulkhead {
  private tenantLimiters = new Map<string, Bottleneck>();
  
  constructor(
    private tierLimits: Record<string, { concurrent: number; perSecond: number }>,
  ) {}

  private getLimiter(tenantId: string, tier: string): Bottleneck {
    const key = `${tenantId}:${tier}`;
    
    if (!this.tenantLimiters.has(key)) {
      const limits = this.tierLimits[tier] || this.tierLimits.default;
      
      const limiter = new Bottleneck({
        maxConcurrent: limits.concurrent,
        reservoir: limits.perSecond,
        reservoirRefreshInterval: 1000,
        reservoirRefreshAmount: limits.perSecond,
      });
      
      limiter.on('dropped', () => {
        metrics.increment('tenant.rate_limited', { tenantId, tier });
      });
      
      this.tenantLimiters.set(key, limiter);
    }
    
    return this.tenantLimiters.get(key)!;
  }

  async execute<T>(
    tenantId: string,
    tier: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const limiter = this.getLimiter(tenantId, tier);
    return limiter.schedule(fn);
  }
}

const tenantBulkhead = new TenantBulkhead({
  enterprise: { concurrent: 50, perSecond: 1000 },
  pro: { concurrent: 20, perSecond: 200 },
  free: { concurrent: 5, perSecond: 50 },
  default: { concurrent: 10, perSecond: 100 },
});

// Middleware
async function tenantIsolation(req: Request, res: Response, next: NextFunction) {
  try {
    await tenantBulkhead.execute(
      req.tenant.id,
      req.tenant.plan,
      () => Promise.resolve(), // Just acquire permit
    );
    next();
  } catch (error) {
    if (error.message.includes('dropped')) {
      res.status(429).json({ error: 'Rate limit exceeded for your plan' });
    } else {
      next(error);
    }
  }
}
```

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| Too small bulkheads | Rejecting valid requests | Size based on load testing |
| Too large bulkheads | No isolation benefit | Start small, increase based on metrics |
| No queue limit | Memory exhaustion | Always set max queue size |
| No timeout on queue | Stuck requests | Set reasonable wait timeout |
| Shared thread pool | Bulkhead bypass | Use true isolation |
| Not monitoring | Can't tune | Track rejection/queue metrics |
| No fallback | Hard failures | Combine with circuit breaker |

## Checklist

- [ ] Bulkheads defined for each downstream service
- [ ] Bulkhead type chosen (semaphore/thread pool/connection)
- [ ] Max concurrent limits configured
- [ ] Queue limits and timeouts set
- [ ] Metrics exposed (concurrent, queued, rejected)
- [ ] Fallback behavior defined
- [ ] Combined with circuit breaker
- [ ] Multi-tenant isolation if applicable
- [ ] Load tested to find optimal sizes
- [ ] Alerts on high rejection rates

## References

- [Azure Bulkhead Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/bulkhead)
- [Resilience4j Bulkhead](https://resilience4j.readme.io/docs/bulkhead)
- [AWS Avoiding Overload](https://aws.amazon.com/builders-library/avoiding-overload-in-distributed-systems/)
- [Bottleneck Library](https://github.com/SGrondin/bottleneck)
