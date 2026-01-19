---
id: rel-load-shedding
title: Load Shedding and Graceful Degradation
tags:
  - reliability
  - load-shedding
  - graceful-degradation
  - resilience
  - overload
level: advanced
stacks:
  - nodejs
  - python
  - go
scope: reliability
maturity: stable
version: 2.0.0
sources:
  - https://sre.google/sre-book/handling-overload/
  - https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/
  - https://netflixtechblog.medium.com/performance-under-load-3e6fa9a60581
  - https://blog.cloudflare.com/the-problem-with-graceful-degradation/
---

# Load Shedding and Graceful Degradation

## Problem

When a service is overloaded:
- **Without load shedding**: All requests slow down, timeouts cascade, system crashes
- **With load shedding**: Some requests rejected fast, others served normally

```
Traffic Spike (3x capacity)
    │
    ▼
┌─────────────────────────────────────┐
│ Without Load Shedding               │
│                                     │
│  Request 1 ────────────────→ Slow   │
│  Request 2 ────────────────→ Slow   │
│  Request 3 ────────────────→ Slow   │
│  Request 4 ────────────────→ Timeout│
│  Request 5 ────────────────→ Timeout│
│                                     │
│  → 0% served at acceptable latency  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ With Load Shedding                  │
│                                     │
│  Request 1 ───────→ OK (fast)       │
│  Request 2 → 503 (shed immediately) │
│  Request 3 ───────→ OK (fast)       │
│  Request 4 → 503 (shed immediately) │
│  Request 5 ───────→ OK (fast)       │
│                                     │
│  → 60% served at acceptable latency │
└─────────────────────────────────────┘
```

## When to use

- Services with variable traffic patterns
- During known traffic spikes (sales, events)
- Dependencies become slow/unavailable
- Protecting critical paths from non-critical traffic
- Multi-tenant systems with noisy neighbors

## Solution

### 1. Queue-Based Load Shedding

```typescript
import { EventEmitter } from 'events';

interface Request {
  id: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  enqueuedAt: number;
  deadline: number;
  handler: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

class LoadSheddingQueue extends EventEmitter {
  private queues: Map<string, Request[]> = new Map([
    ['critical', []],
    ['high', []],
    ['normal', []],
    ['low', []],
  ]);
  
  private processing = 0;
  private config = {
    maxConcurrent: 100,
    maxQueueSize: 1000,
    maxWaitTime: 5000,  // Max time in queue before shedding
    shedLowPriorityAt: 0.7,   // Start shedding 'low' at 70% capacity
    shedNormalPriorityAt: 0.9, // Start shedding 'normal' at 90% capacity
  };

  async enqueue<T>(
    handler: () => Promise<T>,
    options: { priority?: Request['priority']; timeout?: number } = {}
  ): Promise<T> {
    const { priority = 'normal', timeout = 30000 } = options;
    
    // Check if we should shed this request immediately
    if (this.shouldShed(priority)) {
      metrics.increment('load_shedding.shed', { priority, reason: 'capacity' });
      throw new LoadSheddedError('Service at capacity');
    }
    
    // Check queue size
    const totalQueued = this.getTotalQueued();
    if (totalQueued >= this.config.maxQueueSize) {
      metrics.increment('load_shedding.shed', { priority, reason: 'queue_full' });
      throw new LoadSheddedError('Queue full');
    }
    
    return new Promise((resolve, reject) => {
      const request: Request = {
        id: crypto.randomUUID(),
        priority,
        enqueuedAt: Date.now(),
        deadline: Date.now() + timeout,
        handler,
        resolve,
        reject,
      };
      
      this.queues.get(priority)!.push(request);
      metrics.gauge('load_shedding.queue_size', this.getTotalQueued());
      
      this.processNext();
    });
  }

  private shouldShed(priority: Request['priority']): boolean {
    const utilization = this.processing / this.config.maxConcurrent;
    
    switch (priority) {
      case 'critical':
        return false;  // Never shed critical
      case 'high':
        return utilization >= 1.0;  // Only shed when fully loaded
      case 'normal':
        return utilization >= this.config.shedNormalPriorityAt;
      case 'low':
        return utilization >= this.config.shedLowPriorityAt;
    }
  }

  private async processNext() {
    if (this.processing >= this.config.maxConcurrent) {
      return;
    }
    
    const request = this.dequeueNext();
    if (!request) {
      return;
    }
    
    // Check if request has expired in queue
    if (Date.now() > request.deadline) {
      metrics.increment('load_shedding.shed', { 
        priority: request.priority, 
        reason: 'deadline_exceeded' 
      });
      request.reject(new LoadSheddedError('Request deadline exceeded'));
      this.processNext();
      return;
    }
    
    // Check if request waited too long
    const waitTime = Date.now() - request.enqueuedAt;
    if (waitTime > this.config.maxWaitTime) {
      metrics.increment('load_shedding.shed', { 
        priority: request.priority, 
        reason: 'wait_timeout' 
      });
      request.reject(new LoadSheddedError('Wait time exceeded'));
      this.processNext();
      return;
    }
    
    this.processing++;
    metrics.gauge('load_shedding.processing', this.processing);
    
    try {
      const result = await request.handler();
      request.resolve(result);
    } catch (error) {
      request.reject(error as Error);
    } finally {
      this.processing--;
      metrics.gauge('load_shedding.processing', this.processing);
      this.processNext();
    }
  }

  private dequeueNext(): Request | null {
    // Process in priority order: critical → high → normal → low
    for (const priority of ['critical', 'high', 'normal', 'low']) {
      const queue = this.queues.get(priority)!;
      if (queue.length > 0) {
        return queue.shift()!;
      }
    }
    return null;
  }

  private getTotalQueued(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }
}

class LoadSheddedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoadSheddedError';
  }
}
```

### 2. Adaptive Concurrency Limits

```typescript
// Based on Netflix's adaptive concurrency limiter
// Dynamically adjusts limits based on latency

class AdaptiveConcurrencyLimiter {
  private limit: number;
  private inFlight = 0;
  private minLimit: number;
  private maxLimit: number;
  private latencyTarget: number;  // Target latency in ms
  
  // Exponential moving average of latency
  private avgLatency = 0;
  private latencyAlpha = 0.1;
  
  // Gradient tracking
  private rttNoLoad = Infinity;  // Min observed latency (estimate of latency without queueing)

  constructor(options: {
    initialLimit?: number;
    minLimit?: number;
    maxLimit?: number;
    latencyTarget?: number;
  } = {}) {
    this.limit = options.initialLimit || 20;
    this.minLimit = options.minLimit || 5;
    this.maxLimit = options.maxLimit || 200;
    this.latencyTarget = options.latencyTarget || 100;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.inFlight >= this.limit) {
      metrics.increment('adaptive_limiter.rejected');
      throw new LoadSheddedError('Concurrency limit reached');
    }
    
    this.inFlight++;
    const startTime = Date.now();
    
    try {
      const result = await fn();
      this.onSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.onError();
      throw error;
    } finally {
      this.inFlight--;
    }
  }

  private onSuccess(latency: number) {
    // Update RTT no-load estimate
    this.rttNoLoad = Math.min(this.rttNoLoad, latency);
    
    // Update average latency (EMA)
    this.avgLatency = this.latencyAlpha * latency + (1 - this.latencyAlpha) * this.avgLatency;
    
    // Gradient: how much latency increased due to queueing
    const gradient = Math.max(1, this.rttNoLoad / this.avgLatency);
    
    // New limit based on Little's Law adjusted for gradient
    // Limit ≈ gradient * inFlight
    const newLimit = Math.floor(gradient * this.inFlight);
    
    // Smooth adjustment
    if (this.avgLatency < this.latencyTarget) {
      // Under target - can increase limit
      this.limit = Math.min(this.maxLimit, Math.max(this.limit, newLimit) + 1);
    } else if (this.avgLatency > this.latencyTarget * 2) {
      // Way over target - decrease aggressively
      this.limit = Math.max(this.minLimit, Math.floor(this.limit * 0.8));
    } else if (this.avgLatency > this.latencyTarget) {
      // Over target - decrease gradually
      this.limit = Math.max(this.minLimit, this.limit - 1);
    }
    
    metrics.gauge('adaptive_limiter.limit', this.limit);
    metrics.gauge('adaptive_limiter.latency_avg', this.avgLatency);
  }

  private onError() {
    // Reduce limit on errors
    this.limit = Math.max(this.minLimit, Math.floor(this.limit * 0.9));
    metrics.gauge('adaptive_limiter.limit', this.limit);
  }

  getStats() {
    return {
      limit: this.limit,
      inFlight: this.inFlight,
      avgLatency: this.avgLatency,
      rttNoLoad: this.rttNoLoad,
    };
  }
}
```

### 3. Request Priority Classification

```typescript
// Classify requests by importance for shedding decisions

enum RequestPriority {
  CRITICAL = 4,  // Health checks, auth, payment completion
  HIGH = 3,      // User-facing primary flows
  NORMAL = 2,    // Standard requests
  LOW = 1,       // Background tasks, prefetch, analytics
  SHED = 0,      // Always shed under load
}

interface PriorityConfig {
  path: string;
  method?: string;
  priority: RequestPriority;
  canDegrade?: boolean;  // Can serve degraded response
}

const priorityConfig: PriorityConfig[] = [
  // Critical - never shed
  { path: '/health', priority: RequestPriority.CRITICAL },
  { path: '/auth/token', method: 'POST', priority: RequestPriority.CRITICAL },
  { path: '/payments/complete', priority: RequestPriority.CRITICAL },
  
  // High - only shed under extreme load
  { path: '/api/users/*', method: 'GET', priority: RequestPriority.HIGH },
  { path: '/api/orders', method: 'POST', priority: RequestPriority.HIGH },
  
  // Normal - standard shedding
  { path: '/api/products', priority: RequestPriority.NORMAL, canDegrade: true },
  { path: '/api/search', priority: RequestPriority.NORMAL, canDegrade: true },
  
  // Low - shed first
  { path: '/api/recommendations', priority: RequestPriority.LOW, canDegrade: true },
  { path: '/api/analytics', priority: RequestPriority.LOW },
  
  // Always shed under any load
  { path: '/api/export', priority: RequestPriority.SHED },
];

function classifyRequest(req: Request): { priority: RequestPriority; canDegrade: boolean } {
  for (const config of priorityConfig) {
    if (matchPath(req.path, config.path)) {
      if (!config.method || config.method === req.method) {
        return {
          priority: config.priority,
          canDegrade: config.canDegrade ?? false,
        };
      }
    }
  }
  
  // Default: normal priority, no degradation
  return { priority: RequestPriority.NORMAL, canDegrade: false };
}

function matchPath(path: string, pattern: string): boolean {
  const regex = pattern
    .replace(/\*/g, '.*')
    .replace(/\//g, '\\/');
  return new RegExp(`^${regex}$`).test(path);
}
```

### 4. Graceful Degradation Strategies

```typescript
// Serve degraded responses instead of errors

interface DegradedResponse<T> {
  data: T;
  degraded: boolean;
  degradationReason?: string;
}

class GracefulDegradation {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheMaxAge = 300000;  // 5 minutes

  // Strategy 1: Return cached data
  async withCacheFallback<T>(
    key: string,
    freshDataFn: () => Promise<T>,
    options: { maxAge?: number } = {}
  ): Promise<DegradedResponse<T>> {
    try {
      const data = await freshDataFn();
      this.cache.set(key, { data, timestamp: Date.now() });
      return { data, degraded: false };
    } catch (error) {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.timestamp < (options.maxAge || this.cacheMaxAge)) {
        metrics.increment('degradation.cache_fallback');
        return {
          data: cached.data,
          degraded: true,
          degradationReason: 'Serving cached data',
        };
      }
      throw error;
    }
  }

  // Strategy 2: Return partial data
  async withPartialData<T>(
    dataFetchers: { key: string; fn: () => Promise<any>; required: boolean }[]
  ): Promise<DegradedResponse<Partial<T>>> {
    const results: Partial<T> = {};
    let degraded = false;
    const errors: string[] = [];

    await Promise.all(
      dataFetchers.map(async ({ key, fn, required }) => {
        try {
          results[key as keyof T] = await fn();
        } catch (error) {
          if (required) {
            throw error;  // Critical data - fail the request
          }
          degraded = true;
          errors.push(key);
          metrics.increment('degradation.partial_data', { field: key });
        }
      })
    );

    return {
      data: results,
      degraded,
      degradationReason: degraded ? `Missing: ${errors.join(', ')}` : undefined,
    };
  }

  // Strategy 3: Simplified response
  async withSimplifiedResponse<T>(
    fullFn: () => Promise<T>,
    simpleFn: () => Promise<Partial<T>>
  ): Promise<DegradedResponse<T | Partial<T>>> {
    try {
      const data = await fullFn();
      return { data, degraded: false };
    } catch (error) {
      metrics.increment('degradation.simplified_response');
      const data = await simpleFn();
      return {
        data,
        degraded: true,
        degradationReason: 'Serving simplified response',
      };
    }
  }

  // Strategy 4: Static fallback
  async withStaticFallback<T>(
    fn: () => Promise<T>,
    fallback: T
  ): Promise<DegradedResponse<T>> {
    try {
      const data = await fn();
      return { data, degraded: false };
    } catch (error) {
      metrics.increment('degradation.static_fallback');
      return {
        data: fallback,
        degraded: true,
        degradationReason: 'Serving static fallback',
      };
    }
  }
}

// Example: Product page with graceful degradation
app.get('/api/products/:id', async (req, res) => {
  const degradation = new GracefulDegradation();
  const productId = req.params.id;

  const result = await degradation.withPartialData<ProductResponse>([
    // Required - will fail request if unavailable
    {
      key: 'product',
      fn: () => productService.getProduct(productId),
      required: true,
    },
    // Optional - will degrade gracefully
    {
      key: 'reviews',
      fn: () => reviewService.getReviews(productId),
      required: false,
    },
    {
      key: 'recommendations',
      fn: () => recommendationService.getRecommendations(productId),
      required: false,
    },
    {
      key: 'inventory',
      fn: () => inventoryService.getStock(productId),
      required: false,
    },
  ]);

  // Set header to indicate degradation
  if (result.degraded) {
    res.setHeader('X-Degraded', 'true');
    res.setHeader('X-Degradation-Reason', result.degradationReason!);
  }

  res.json(result.data);
});
```

### 5. Load Shedding Middleware

```typescript
import { Request, Response, NextFunction } from 'express';

class LoadSheddingMiddleware {
  private limiter: AdaptiveConcurrencyLimiter;
  private queue: LoadSheddingQueue;
  private degradation: GracefulDegradation;
  private currentLoad = 0;
  private loadThreshold = 0.8;  // Start shedding at 80% load

  constructor() {
    this.limiter = new AdaptiveConcurrencyLimiter({
      initialLimit: 100,
      latencyTarget: 200,
    });
    this.queue = new LoadSheddingQueue();
    this.degradation = new GracefulDegradation();
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const { priority, canDegrade } = classifyRequest(req);
      
      // Update load metrics
      this.currentLoad = this.limiter.getStats().inFlight / this.limiter.getStats().limit;
      metrics.gauge('load_shedding.load_factor', this.currentLoad);
      
      // Check if we should shed this request
      if (this.shouldShed(priority)) {
        metrics.increment('load_shedding.rejected', {
          path: req.path,
          priority: RequestPriority[priority],
        });
        
        // Return 503 with Retry-After
        res.setHeader('Retry-After', '5');
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          code: 'LOAD_SHEDDING',
          retryAfter: 5,
        });
      }
      
      // Check if we should degrade
      if (canDegrade && this.currentLoad > 0.6) {
        req.headers['x-degrade-response'] = 'true';
      }
      
      // Process with concurrency limiter
      try {
        await this.limiter.execute(async () => {
          return new Promise<void>((resolve, reject) => {
            res.on('finish', resolve);
            res.on('error', reject);
            next();
          });
        });
      } catch (error) {
        if (error instanceof LoadSheddedError) {
          res.setHeader('Retry-After', '5');
          return res.status(503).json({
            error: 'Service temporarily unavailable',
            code: 'LOAD_SHEDDING',
          });
        }
        next(error);
      }
    };
  }

  private shouldShed(priority: RequestPriority): boolean {
    if (priority === RequestPriority.CRITICAL) return false;
    if (priority === RequestPriority.SHED) return true;
    
    const thresholds = {
      [RequestPriority.HIGH]: 0.95,
      [RequestPriority.NORMAL]: 0.85,
      [RequestPriority.LOW]: 0.70,
    };
    
    return this.currentLoad > thresholds[priority];
  }
}

// Usage
const loadShedding = new LoadSheddingMiddleware();
app.use(loadShedding.middleware());
```

### 6. Feature Flags for Degradation

```typescript
// Runtime toggles for degradation strategies

interface FeatureFlags {
  recommendationsEnabled: boolean;
  searchEnabled: boolean;
  cacheOnlyMode: boolean;
  simplifiedResponses: boolean;
  readOnlyMode: boolean;
}

class DegradationFlags {
  private flags: FeatureFlags = {
    recommendationsEnabled: true,
    searchEnabled: true,
    cacheOnlyMode: false,
    simplifiedResponses: false,
    readOnlyMode: false,
  };
  
  private listeners: ((flags: FeatureFlags) => void)[] = [];

  // Called by ops/automation during incidents
  enableCacheOnlyMode() {
    this.flags.cacheOnlyMode = true;
    this.notifyListeners();
    logger.warn('Degradation: Cache-only mode enabled');
  }

  enableReadOnlyMode() {
    this.flags.readOnlyMode = true;
    this.notifyListeners();
    logger.warn('Degradation: Read-only mode enabled');
  }

  disableNonEssential() {
    this.flags.recommendationsEnabled = false;
    this.flags.searchEnabled = false;
    this.flags.simplifiedResponses = true;
    this.notifyListeners();
    logger.warn('Degradation: Non-essential features disabled');
  }

  restoreNormal() {
    this.flags = {
      recommendationsEnabled: true,
      searchEnabled: true,
      cacheOnlyMode: false,
      simplifiedResponses: false,
      readOnlyMode: false,
    };
    this.notifyListeners();
    logger.info('Degradation: Normal mode restored');
  }

  getFlags(): Readonly<FeatureFlags> {
    return { ...this.flags };
  }

  subscribe(listener: (flags: FeatureFlags) => void) {
    this.listeners.push(listener);
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.flags);
    }
  }
}

// Usage in route handlers
const degradationFlags = new DegradationFlags();

app.post('/api/orders', async (req, res) => {
  const flags = degradationFlags.getFlags();
  
  if (flags.readOnlyMode) {
    return res.status(503).json({
      error: 'Service in read-only mode',
      code: 'READ_ONLY_MODE',
    });
  }
  
  // Process order...
});

app.get('/api/products/:id', async (req, res) => {
  const flags = degradationFlags.getFlags();
  
  const product = await productService.getProduct(req.params.id);
  
  const response: any = { product };
  
  if (flags.recommendationsEnabled && !flags.simplifiedResponses) {
    try {
      response.recommendations = await recommendationService.get(req.params.id);
    } catch {
      // Ignore - gracefully degrade
    }
  }
  
  res.json(response);
});

// Ops API for toggling degradation
app.post('/ops/degradation/:mode', authOps, async (req, res) => {
  switch (req.params.mode) {
    case 'cache-only':
      degradationFlags.enableCacheOnlyMode();
      break;
    case 'read-only':
      degradationFlags.enableReadOnlyMode();
      break;
    case 'minimal':
      degradationFlags.disableNonEssential();
      break;
    case 'normal':
      degradationFlags.restoreNormal();
      break;
    default:
      return res.status(400).json({ error: 'Unknown mode' });
  }
  
  res.json({ status: 'ok', flags: degradationFlags.getFlags() });
});
```

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| Shedding critical requests | Breaking essential flows | Classify requests by priority |
| No retry guidance | Clients retry immediately | Return Retry-After header |
| All-or-nothing shedding | Poor UX | Implement partial degradation |
| Static limits | Poor adaptation | Use adaptive concurrency limits |
| No observability | Can't tune | Track shed rate, latency, capacity |
| Shedding at wrong layer | Ineffective | Shed as early as possible (LB/gateway) |
| No manual controls | Can't react to incidents | Add ops API for degradation flags |

## Checklist

- [ ] Request priority classification defined
- [ ] Load shedding middleware in place
- [ ] Adaptive concurrency limits
- [ ] Graceful degradation for non-critical data
- [ ] 503 responses include Retry-After header
- [ ] Metrics for shed rate, latency, capacity
- [ ] Manual degradation toggles for ops
- [ ] Load testing to validate behavior
- [ ] Alerting on high shed rates
- [ ] Documentation for priority levels

## References

- [Google SRE: Handling Overload](https://sre.google/sre-book/handling-overload/)
- [AWS: Using Load Shedding](https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/)
- [Netflix: Performance Under Load](https://netflixtechblog.medium.com/performance-under-load-3e6fa9a60581)
- [Cloudflare: Graceful Degradation](https://blog.cloudflare.com/the-problem-with-graceful-degradation/)
