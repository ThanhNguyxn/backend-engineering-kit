---
id: obs-correlation-id
title: Correlation ID
tags:
  - observability
  - tracing
  - debugging
  - distributed-systems
level: beginner
stacks:
  - all
scope: observability
maturity: stable
---

# Correlation ID

## Problem

In distributed systems, a single user request may span multiple services, databases, and queues. Without a common identifier linking all these operations, debugging becomes nearly impossible.

## When to use

- Any distributed system
- Microservices architecture
- Request tracing across services
- Log correlation
- Debugging production issues

## Solution

1. **Generate at entry point**
   - Create unique ID at edge (API gateway, load balancer)
   - Use UUID, ULID, or similar
   - Accept from client if provided (for end-to-end tracing)

2. **Propagate everywhere**
   - Pass in HTTP headers (`X-Correlation-ID`, `X-Request-ID`)
   - Include in async messages
   - Store in thread-local/context

3. **Log with every entry**
   - Attach to all log entries
   - Include in error responses
   - Pass to downstream services

4. **Integrate with tracing**
   - Use as parent span ID
   - Link with OpenTelemetry/Jaeger
   - Enable distributed tracing

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
