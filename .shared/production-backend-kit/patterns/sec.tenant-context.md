---
id: sec.tenant-context
title: Tenant Context Propagation
tags: [security, multitenancy, context, async]
scope: security
level: intermediate
maturity: stable
stacks: [nodejs, python, go, all]
description: Propagating tenant context through request lifecycle
version: 2.0.0
sources:
  - https://nodejs.org/api/async_context.html
  - https://docs.python.org/3/library/contextvars.html
  - https://opentelemetry.io/docs/concepts/context-propagation/
---

# Tenant Context Propagation

## Problem

Tenant context must flow seamlessly through the entire request lifecycle: from HTTP request → business logic → database queries → logs → background jobs.

## When to use

- Multi-tenant SaaS with shared database
- Need consistent tenant scoping across layers
- Want automatic tenant filtering in ORM/queries
- Require tenant info in all log entries

## Solution

### 1. AsyncLocalStorage for Context (Node.js)

```typescript
import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  tenantId: string;
  userId: string;
  correlationId: string;
  startTime: number;
}

export const asyncContext = new AsyncLocalStorage<RequestContext>();

// Get current context
export function getContext(): RequestContext | undefined {
  return asyncContext.getStore();
}

export function getTenantId(): string {
  const ctx = getContext();
  if (!ctx?.tenantId) {
    throw new Error('No tenant context available');
  }
  return ctx.tenantId;
}
```

### 2. Middleware Setup

```typescript
app.use((req, res, next) => {
  const context: RequestContext = {
    tenantId: req.tenant.id,
    userId: req.user?.id || 'anonymous',
    correlationId: req.headers['x-correlation-id'] || crypto.randomUUID(),
    startTime: Date.now(),
  };

  asyncContext.run(context, () => {
    // All downstream code has access to context
    next();
  });
});
```

### 3. Database Query Scoping

```typescript
// Base repository with automatic tenant scoping
class TenantScopedRepository<T> {
  constructor(private model: Model<T>) {}

  async findAll(where: Partial<T> = {}): Promise<T[]> {
    return this.model.find({
      ...where,
      tenant_id: getTenantId(), // Automatic!
    });
  }

  async create(data: Omit<T, 'tenant_id'>): Promise<T> {
    return this.model.create({
      ...data,
      tenant_id: getTenantId(), // Automatic!
    });
  }

  async findById(id: string): Promise<T | null> {
    return this.model.findOne({
      id,
      tenant_id: getTenantId(), // Prevents cross-tenant access
    });
  }
}

// Usage
const userRepo = new TenantScopedRepository(UserModel);
const users = await userRepo.findAll({ active: true });
// SQL: SELECT * FROM users WHERE active = true AND tenant_id = 'current-tenant'
```

### 4. Structured Logging with Context

```typescript
import pino from 'pino';

function createLogger() {
  return pino({
    mixin() {
      const ctx = getContext();
      return ctx ? {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        correlationId: ctx.correlationId,
      } : {};
    }
  });
}

const logger = createLogger();

// All logs automatically include tenant context
logger.info({ action: 'order.created', orderId: '123' });
// Output: { "tenantId": "acme", "userId": "user1", "correlationId": "abc", "action": "order.created" }
```

### 5. Background Job Context

```typescript
// When enqueuing jobs, include tenant context
async function enqueueJob(jobType: string, payload: any) {
  const ctx = getContext();
  
  await jobQueue.add(jobType, {
    ...payload,
    _context: {
      tenantId: ctx?.tenantId,
      correlationId: ctx?.correlationId,
    }
  });
}

// Job processor restores context
jobQueue.process('*', async (job) => {
  const { _context, ...payload } = job.data;
  
  // Restore context for the job
  await asyncContext.run(_context, async () => {
    await processJob(job.name, payload);
  });
});
```

## Pitfalls

1. **Context lost in callbacks**: Use `asyncContext.run()` properly
2. **Missing context in error handlers**: Log errors may lack tenant info
3. **Third-party libraries**: Some bypass AsyncLocalStorage
4. **Tests without context**: Mock context in unit tests

## Checklist

- [ ] AsyncLocalStorage (or equivalent) configured
- [ ] Middleware sets context on every request
- [ ] All repositories use tenant-scoped queries
- [ ] Logs include tenant context automatically
- [ ] Background jobs preserve and restore context
- [ ] Error handlers have access to context
