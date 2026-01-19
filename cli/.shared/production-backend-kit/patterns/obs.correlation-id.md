---
id: obs-correlation-id
title: Correlation ID & Distributed Tracing
tags:
  - observability
  - tracing
  - debugging
  - distributed-systems
  - opentelemetry
level: beginner
stacks:
  - all
scope: observability
maturity: stable
version: 2.0.0
sources:
  - https://www.w3.org/TR/trace-context/
  - https://opentelemetry.io/docs/concepts/signals/traces/
  - https://www.datadoghq.com/blog/request-tracing-correlation/
---

# Correlation ID & Distributed Tracing

## Problem

In distributed systems, a single user request may span multiple services, databases, and queues. Without a common identifier linking all these operations, debugging becomes nearly impossible. "Why did this request fail?" becomes an hours-long investigation.

## When to use

- Any distributed system
- Microservices architecture
- Request tracing across services
- Log correlation
- Debugging production issues
- Performance analysis

## Solution

### 1. W3C Trace Context Standard

Use the W3C standard for interoperability:

```http
# Request headers
traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
tracestate: vendor1=value1,vendor2=value2

# Format: version-traceId-spanId-flags
# 00 = version
# 0af7651916cd43dd8448eb211c80319c = trace ID (32 hex chars)
# b7ad6b7169203331 = span ID (16 hex chars)  
# 01 = flags (01 = sampled)
```

### 2. Implementation with OpenTelemetry

```typescript
import { trace, context, propagation } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

// Setup
const provider = new NodeTracerProvider();
provider.register({
  propagator: new W3CTraceContextPropagator(),
});

const tracer = trace.getTracer('order-service');

// Create span for operation
async function createOrder(orderData: OrderInput): Promise<Order> {
  return tracer.startActiveSpan('createOrder', async (span) => {
    try {
      span.setAttribute('order.items_count', orderData.items.length);
      
      // Child span for database
      const order = await tracer.startActiveSpan('db.insert', async (dbSpan) => {
        const result = await db.orders.create(orderData);
        dbSpan.setAttribute('db.table', 'orders');
        dbSpan.end();
        return result;
      });
      
      span.setAttribute('order.id', order.id);
      return order;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

### 3. Simple Correlation ID (Without Full Tracing)

```typescript
import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  correlationId: string;
  userId?: string;
  tenantId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

// Middleware
export function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  // Extract or generate correlation ID
  const correlationId = 
    req.headers['x-correlation-id'] as string ||
    req.headers['x-request-id'] as string ||
    `req_${uuidv4()}`;
  
  const context: RequestContext = {
    correlationId,
    userId: req.user?.id,
    tenantId: req.tenant?.id,
  };
  
  // Set response header
  res.setHeader('X-Correlation-ID', correlationId);
  
  // Run request in context
  asyncLocalStorage.run(context, () => next());
}

// Get context anywhere
export function getCorrelationId(): string | undefined {
  return asyncLocalStorage.getStore()?.correlationId;
}

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}
```

### 4. Propagation to Async Jobs

```typescript
import { Queue, Worker } from 'bullmq';

interface JobData {
  // Always include context
  _context: {
    correlationId: string;
    userId?: string;
    tenantId?: string;
  };
  // Job-specific data
  payload: any;
}

// When creating job
const queue = new Queue('orders');

async function queueOrderProcessing(orderId: string) {
  const context = getRequestContext();
  
  await queue.add('process-order', {
    _context: {
      correlationId: context?.correlationId || `job_${uuidv4()}`,
      userId: context?.userId,
      tenantId: context?.tenantId,
    },
    payload: { orderId },
  });
}

// Worker restores context
const worker = new Worker('orders', async (job) => {
  const { _context, payload } = job.data as JobData;
  
  // Restore context for this job
  return asyncLocalStorage.run(_context, async () => {
    logger.info({ orderId: payload.orderId }, 'Processing order');
    // All logs will include correlationId
    await processOrder(payload.orderId);
  });
});
```

### 5. HTTP Client Propagation

```typescript
import axios from 'axios';

// Create axios instance that propagates context
const httpClient = axios.create();

httpClient.interceptors.request.use((config) => {
  const context = getRequestContext();
  
  if (context?.correlationId) {
    config.headers['X-Correlation-ID'] = context.correlationId;
  }
  if (context?.tenantId) {
    config.headers['X-Tenant-ID'] = context.tenantId;
  }
  
  return config;
});

// Usage - context automatically propagated
const response = await httpClient.get('http://payment-service/api/charge');
```

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Not propagating to async jobs | Explicitly pass correlation ID in job payload |
| Generating new ID at each service | Only generate at edge, propagate everywhere |
| Not logging correlation ID | Add to logging context/MDC |
| Missing from error responses | Include in all responses for debugging |
| Inconsistent header names | Standardize on one name across org |

## Checklist

- [ ] Correlation ID generated at entry point
- [ ] ID propagated in HTTP headers
- [ ] ID attached to all log entries
- [ ] ID included in error responses
- [ ] ID passed in async message payloads
- [ ] Thread-local/context stores current ID
- [ ] Downstream services extract and use ID
- [ ] Header name standardized across services
- [ ] ID format is URL-safe
- [ ] Integration with distributed tracing

## Snippets (Generic)

```
HTTP Header:
X-Correlation-ID: corr_a1b2c3d4-e5f6-7890-abcd-ef1234567890

Request Flow:
Client → API Gateway → Service A → Service B → Database
         │                │            │
         └── corr_abc ────┴── corr_abc─┴── corr_abc

Middleware Implementation:
def correlation_middleware(request, next):
  # Extract or generate
  correlation_id = request.headers.get('X-Correlation-ID')
  if not correlation_id:
    correlation_id = generate_uuid()
  
  # Store in context
  context.set('correlation_id', correlation_id)
  
  # Add to logging context
  logging.set_context({'correlation_id': correlation_id})
  
  # Process request
  response = next(request)
  
  # Include in response
  response.headers['X-Correlation-ID'] = correlation_id
  return response

Log Entry:
{
  "timestamp": "2026-01-14T12:00:00Z",
  "level": "INFO",
  "message": "Order created",
  "correlation_id": "corr_a1b2c3d4",
  "service": "order-service",
  "user_id": "user_123"
}

Async Job Payload:
{
  "job_type": "send_email",
  "correlation_id": "corr_a1b2c3d4",  # Propagated!
  "payload": { ... }
}
```

## Sources

- OpenTelemetry Trace Context: https://www.w3.org/TR/trace-context/
- AWS X-Ray Tracing: https://docs.aws.amazon.com/xray/latest/devguide/xray-concepts.html
- Microservices Logging Best Practices: https://www.datadoghq.com/blog/microservices-logging-best-practices/
- Spring Cloud Sleuth: https://spring.io/projects/spring-cloud-sleuth
