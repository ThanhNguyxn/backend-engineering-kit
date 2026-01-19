---
id: obs-distributed-tracing
title: Distributed Tracing with OpenTelemetry
tags:
  - observability
  - tracing
  - opentelemetry
  - debugging
  - microservices
level: intermediate
stacks:
  - all
scope: observability
maturity: stable
version: 2.0.0
sources:
  - https://opentelemetry.io/docs/
  - https://www.jaegertracing.io/docs/
  - https://research.google/pubs/pub36356/ # Dapper paper
  - https://www.w3.org/TR/trace-context/
---

# Distributed Tracing with OpenTelemetry

## Problem

In microservices architectures:
- Request flows through multiple services - hard to debug
- Latency issues are difficult to pinpoint
- Errors propagate without clear origin
- Performance bottlenecks hidden across service boundaries
- "It worked on my machine" but fails in production

Logs alone can't show the complete picture of a distributed request.

## When to use

- Microservices or service-oriented architectures
- Any system with >2 networked services
- Debugging latency issues
- Understanding request flows
- Performance optimization
- Root cause analysis for errors
- SLO compliance tracking

## Solution

### 1. Core Concepts

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DISTRIBUTED TRACE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Trace ID: abc123 (unique identifier for entire request flow)               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Span: API Gateway (parent)                                          │   │
│  │ span_id: span_001, duration: 250ms                                  │   │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │ │ Span: User Service (child)                                      │ │   │
│  │ │ span_id: span_002, parent: span_001, duration: 50ms             │ │   │
│  │ └─────────────────────────────────────────────────────────────────┘ │   │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │ │ Span: Order Service (child)                                     │ │   │
│  │ │ span_id: span_003, parent: span_001, duration: 180ms            │ │   │
│  │ │ ┌─────────────────────────────────────────────────────────────┐ │ │   │
│  │ │ │ Span: Database Query                                        │ │ │   │
│  │ │ │ span_id: span_004, parent: span_003, duration: 45ms         │ │ │   │
│  │ │ └─────────────────────────────────────────────────────────────┘ │ │   │
│  │ │ ┌─────────────────────────────────────────────────────────────┐ │ │   │
│  │ │ │ Span: Payment Service                                       │ │ │   │
│  │ │ │ span_id: span_005, parent: span_003, duration: 120ms        │ │ │   │
│  │ │ └─────────────────────────────────────────────────────────────┘ │ │   │
│  │ └─────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Key Terms:
- Trace: End-to-end journey of a request
- Span: Single operation within a trace
- Context: Propagated metadata (trace_id, span_id, flags)
```

### 2. OpenTelemetry Setup (Node.js)

```typescript
// tracing.ts - Initialize BEFORE other imports!
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

const exporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
});

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.SERVICE_NAME || 'my-service',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  }),
  spanProcessor: new BatchSpanProcessor(exporter, {
    maxQueueSize: 2048,
    maxExportBatchSize: 512,
    scheduledDelayMillis: 5000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Customize which instrumentations to enable
      '@opentelemetry/instrumentation-fs': { enabled: false }, // Disable noisy fs
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingPaths: ['/health', '/ready', '/metrics'],
      },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing shut down'))
    .catch((err) => console.error('Error shutting down tracing', err))
    .finally(() => process.exit(0));
});

export { sdk };
```

```typescript
// index.ts - Import tracing FIRST
import './tracing';
import express from 'express';
import { trace, SpanStatusCode, context } from '@opentelemetry/api';

const tracer = trace.getTracer('my-service');

const app = express();

// Manual span creation for custom operations
app.post('/orders', async (req, res) => {
  // Auto-instrumentation creates HTTP span automatically
  
  // Add custom span for business logic
  const span = tracer.startSpan('process-order', {
    attributes: {
      'order.customer_id': req.body.customerId,
      'order.item_count': req.body.items.length,
    },
  });
  
  try {
    // Validate order
    await tracer.startActiveSpan('validate-order', async (validateSpan) => {
      await validateOrder(req.body);
      validateSpan.end();
    });
    
    // Process payment
    await tracer.startActiveSpan('process-payment', async (paymentSpan) => {
      paymentSpan.setAttribute('payment.amount', req.body.total);
      const result = await paymentService.charge(req.body);
      paymentSpan.setAttribute('payment.transaction_id', result.transactionId);
      paymentSpan.end();
    });
    
    // Create order record
    const order = await createOrder(req.body);
    
    span.setAttribute('order.id', order.id);
    span.setStatus({ code: SpanStatusCode.OK });
    
    res.json(order);
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    res.status(500).json({ error: error.message });
  } finally {
    span.end();
  }
});
```

### 3. Context Propagation

```typescript
// W3C Trace Context headers (standard)
// traceparent: 00-{trace_id}-{span_id}-{flags}
// tracestate: vendor-specific data

// Propagating context to downstream services
import { propagation, context } from '@opentelemetry/api';

async function callDownstreamService(endpoint: string, data: any) {
  const headers: Record<string, string> = {};
  
  // Inject trace context into headers
  propagation.inject(context.active(), headers);
  
  // headers now contains:
  // traceparent: 00-abc123-def456-01
  // tracestate: ...
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers, // Include trace context
    },
    body: JSON.stringify(data),
  });
  
  return response.json();
}

// For message queues - include context in message
async function publishMessage(queue: string, message: any) {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  
  await messageQueue.publish(queue, {
    ...message,
    _traceContext: carrier, // Embed trace context
  });
}

// Consumer extracts context
async function consumeMessage(message: any) {
  const extractedContext = propagation.extract(context.active(), message._traceContext);
  
  return context.with(extractedContext, async () => {
    // All spans created here will be part of original trace
    await processMessage(message);
  });
}
```

### 4. Python Setup (FastAPI)

```python
# tracing.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
import os

def setup_tracing(app):
    resource = Resource.create({
        "service.name": os.getenv("SERVICE_NAME", "my-service"),
        "service.version": os.getenv("SERVICE_VERSION", "1.0.0"),
        "deployment.environment": os.getenv("ENVIRONMENT", "development"),
    })
    
    provider = TracerProvider(resource=resource)
    
    exporter = OTLPSpanExporter(
        endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "localhost:4317"),
    )
    
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    
    # Auto-instrument
    FastAPIInstrumentor.instrument_app(app)
    SQLAlchemyInstrumentor().instrument()
    HTTPXClientInstrumentor().instrument()

# main.py
from fastapi import FastAPI
from tracing import setup_tracing
from opentelemetry import trace

app = FastAPI()
setup_tracing(app)

tracer = trace.get_tracer(__name__)

@app.post("/orders")
async def create_order(order: OrderCreate):
    with tracer.start_as_current_span("process-order") as span:
        span.set_attribute("order.customer_id", order.customer_id)
        
        try:
            # Validate
            with tracer.start_as_current_span("validate-order"):
                await validate_order(order)
            
            # Process payment
            with tracer.start_as_current_span("process-payment") as payment_span:
                result = await payment_service.charge(order)
                payment_span.set_attribute("payment.transaction_id", result.transaction_id)
            
            # Create record
            created = await order_service.create(order)
            span.set_attribute("order.id", str(created.id))
            
            return created
            
        except Exception as e:
            span.record_exception(e)
            span.set_status(trace.StatusCode.ERROR, str(e))
            raise
```

### 5. Span Attributes & Events

```typescript
// Semantic conventions - use standard attribute names
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';

span.setAttributes({
  // HTTP
  [SemanticAttributes.HTTP_METHOD]: 'POST',
  [SemanticAttributes.HTTP_URL]: '/api/orders',
  [SemanticAttributes.HTTP_STATUS_CODE]: 201,
  [SemanticAttributes.HTTP_USER_AGENT]: req.headers['user-agent'],
  
  // Database
  [SemanticAttributes.DB_SYSTEM]: 'postgresql',
  [SemanticAttributes.DB_NAME]: 'orders',
  [SemanticAttributes.DB_OPERATION]: 'INSERT',
  [SemanticAttributes.DB_STATEMENT]: 'INSERT INTO orders...', // Be careful with PII!
  
  // Messaging
  [SemanticAttributes.MESSAGING_SYSTEM]: 'rabbitmq',
  [SemanticAttributes.MESSAGING_DESTINATION]: 'orders.created',
  [SemanticAttributes.MESSAGING_MESSAGE_ID]: message.id,
  
  // Custom business attributes
  'order.id': orderId,
  'order.total': total,
  'customer.tier': 'premium',
});

// Events - point-in-time occurrences within a span
span.addEvent('order.validated', {
  'validation.checks_passed': 5,
  'validation.duration_ms': 12,
});

span.addEvent('payment.initiated', {
  'payment.provider': 'stripe',
  'payment.amount': 9999,
});

span.addEvent('inventory.reserved', {
  'items.count': 3,
  'warehouse': 'US-WEST-1',
});
```

### 6. Sampling Strategies

```typescript
import { 
  ParentBasedSampler, 
  TraceIdRatioBasedSampler,
  AlwaysOnSampler,
  AlwaysOffSampler,
} from '@opentelemetry/sdk-trace-base';

// Sample 10% of traces in production
const sampler = new ParentBasedSampler({
  root: new TraceIdRatioBasedSampler(0.1), // 10%
});

// Custom sampler - always sample errors and slow requests
class SmartSampler implements Sampler {
  shouldSample(context, traceId, spanName, spanKind, attributes) {
    // Always sample errors
    if (attributes['error'] === true) {
      return { decision: SamplingDecision.RECORD_AND_SAMPLED };
    }
    
    // Always sample specific endpoints
    const importantEndpoints = ['/api/payments', '/api/orders'];
    if (importantEndpoints.some(e => attributes['http.url']?.includes(e))) {
      return { decision: SamplingDecision.RECORD_AND_SAMPLED };
    }
    
    // Sample 5% of everything else
    return Math.random() < 0.05 
      ? { decision: SamplingDecision.RECORD_AND_SAMPLED }
      : { decision: SamplingDecision.NOT_RECORD };
  }
}

// Tail-based sampling (in collector)
// Sample after seeing full trace - useful for sampling slow traces
// Configure in OpenTelemetry Collector:
/*
processors:
  tail_sampling:
    decision_wait: 10s
    policies:
      - name: latency-policy
        type: latency
        latency:
          threshold_ms: 1000  # Sample traces > 1s
      - name: error-policy
        type: status_code
        status_code:
          status_codes: [ERROR]
      - name: probabilistic-policy
        type: probabilistic
        probabilistic:
          sampling_percentage: 10
*/
```

### 7. Connecting Traces to Logs

```typescript
import pino from 'pino';
import { trace, context } from '@opentelemetry/api';

const logger = pino({
  mixin() {
    const span = trace.getSpan(context.active());
    if (span) {
      const spanContext = span.spanContext();
      return {
        trace_id: spanContext.traceId,
        span_id: spanContext.spanId,
        trace_flags: spanContext.traceFlags,
      };
    }
    return {};
  },
});

// Now all logs include trace context!
logger.info({ orderId: '123' }, 'Order created');
// Output: { "trace_id": "abc123", "span_id": "def456", "orderId": "123", "msg": "Order created" }

// In your log aggregator, you can now:
// 1. Click on trace_id to see full distributed trace
// 2. Filter logs by trace_id to see all logs for one request
```

### 8. Jaeger/Grafana Tempo Setup

```yaml
# docker-compose.yml
version: '3'
services:
  # OpenTelemetry Collector
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
      - "8889:8889"   # Prometheus metrics

  # Jaeger for trace visualization
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686" # UI
      - "14250:14250" # gRPC

  # Or Grafana Tempo
  tempo:
    image: grafana/tempo:latest
    command: ["-config.file=/etc/tempo.yaml"]
    volumes:
      - ./tempo.yaml:/etc/tempo.yaml

---
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 5s
    send_batch_size: 1024

exporters:
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true
  
  logging:
    loglevel: debug

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [jaeger, logging]
```

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| No sampling | Massive data volume, cost | Use head or tail sampling |
| PII in spans | Security/compliance violation | Scrub sensitive data |
| Missing context propagation | Broken traces | Test cross-service flows |
| Too many spans | Noise, performance overhead | Instrument meaningful operations |
| No correlation with logs | Hard to debug | Include trace_id in all logs |
| Not instrumenting queues | Gaps in traces | Propagate context in messages |
| Ignoring async operations | Missing spans | Use context.with() |

## Checklist

- [ ] OpenTelemetry SDK initialized early (before imports)
- [ ] Auto-instrumentation enabled for frameworks
- [ ] Context propagation across HTTP calls
- [ ] Context propagation for message queues
- [ ] Custom spans for business operations
- [ ] Semantic attributes used
- [ ] Sampling strategy defined
- [ ] Trace ID in all logs
- [ ] Sensitive data scrubbed
- [ ] Collector deployed and configured
- [ ] Visualization tool (Jaeger/Tempo) accessible
- [ ] Alerts on trace anomalies

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [Google Dapper Paper](https://research.google/pubs/pub36356/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Grafana Tempo](https://grafana.com/docs/tempo/latest/)
