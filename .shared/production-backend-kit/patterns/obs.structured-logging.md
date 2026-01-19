---
id: obs-structured-logging
title: Structured Logging
tags:
  - observability
  - logging
  - json
  - debugging
  - elk
level: beginner
stacks:
  - all
scope: observability
maturity: stable
version: 2.0.0
sources:
  - https://www.datadoghq.com/blog/microservices-logging-best-practices/
  - https://12factor.net/logs
  - https://www.elastic.co/guide/en/ecs/current/index.html
---

# Structured Logging

## Problem

Unstructured log messages are hard to parse, search, and analyze. Free-form text logs make automated monitoring and alerting nearly impossible at scale. Finding issues across distributed services becomes a nightmare.

## When to use

- All production applications
- Microservices environments
- Any system requiring log analysis
- When using log aggregation (ELK, Datadog, CloudWatch)
- Debugging distributed systems

## Solution

### 1. JSON Log Format

```json
{
  "timestamp": "2026-01-15T10:30:00.123Z",
  "level": "INFO",
  "message": "Order created successfully",
  "service": "order-service",
  "version": "1.2.3",
  "environment": "production",
  "correlationId": "req_abc123",
  "traceId": "trace_xyz789",
  "spanId": "span_def456",
  "userId": "user_123",
  "tenantId": "tenant_456",
  "orderId": "order_789",
  "duration_ms": 145,
  "request": {
    "method": "POST",
    "path": "/api/orders",
    "userAgent": "Mozilla/5.0..."
  }
}
```

### 2. Standard Fields (ECS-Inspired)

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO 8601 with milliseconds |
| `level` | string | DEBUG, INFO, WARN, ERROR |
| `message` | string | Human-readable description |
| `service` | string | Service/application name |
| `version` | string | Application version |
| `environment` | string | prod, staging, dev |
| `correlationId` | string | Request tracing ID |
| `traceId` | string | Distributed trace ID |
| `userId` | string | User identifier (if authenticated) |
| `tenantId` | string | Tenant identifier (if multi-tenant) |
| `duration_ms` | number | Operation duration |
| `error` | object | Error details (type, message, stack) |

### 3. Implementation (Node.js with Pino)

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
  base: {
    service: 'order-service',
    version: process.env.APP_VERSION,
    environment: process.env.NODE_ENV,
  },
  timestamp: () => `"timestamp":"${new Date().toISOString()}"`,
  redact: {
    paths: ['password', 'token', 'authorization', 'cookie', '*.password', '*.token'],
    censor: '[REDACTED]',
  },
});

// Create child logger with request context
function createRequestLogger(req: Request) {
  return logger.child({
    correlationId: req.headers['x-correlation-id'],
    traceId: req.headers['x-trace-id'],
    userId: req.user?.id,
    tenantId: req.tenant?.id,
    request: {
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
    },
  });
}

// Usage
app.use((req, res, next) => {
  req.log = createRequestLogger(req);
  next();
});

// In handlers
req.log.info({ orderId: order.id }, 'Order created successfully');
req.log.error({ err, orderId }, 'Failed to create order');
```

### 4. Log Levels Usage

| Level | When to Use | Examples |
|-------|-------------|----------|
| **DEBUG** | Detailed dev info, disable in prod | Variable values, loop iterations |
| **INFO** | Normal operations, milestones | Request received, job completed |
| **WARN** | Unexpected but handled | Retry succeeded, fallback used |
| **ERROR** | Failures requiring attention | Unhandled exception, external failure |

```typescript
// DEBUG - development only
logger.debug({ payload, headers }, 'Processing webhook');

// INFO - normal operations
logger.info({ userId, action: 'LOGIN' }, 'User logged in');

// WARN - degraded but functional
logger.warn({ retryCount, service }, 'Retrying failed request');

// ERROR - needs attention
logger.error({ err, userId, orderId }, 'Payment processing failed');
```

### 5. Sensitive Data Redaction

```typescript
import pino from 'pino';

const sensitiveFields = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'creditCard',
  'ssn',
  'apiKey',
  '*.password',
  '*.token',
  'headers.authorization',
  'body.password',
];

const logger = pino({
  redact: {
    paths: sensitiveFields,
    censor: '[REDACTED]',
  },
});

// Custom redaction for complex cases
function sanitizeForLogging(obj: any): any {
  const clone = JSON.parse(JSON.stringify(obj));
  
  // Mask email
  if (clone.email) {
    clone.email = clone.email.replace(/(.{2}).*@/, '$1***@');
  }
  
  // Mask credit card
  if (clone.creditCard) {
    clone.creditCard = '**** **** **** ' + clone.creditCard.slice(-4);
  }
  
  return clone;
}
```

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Logging sensitive data | Create allowlist, auto-mask patterns |
| Inconsistent field names | Define org-wide logging schema |
| Giant log entries | Set size limits, truncate long values |
| Not including context | Use logging context/MDC |
| Mixing formats | Enforce JSON-only in production |

## Checklist

- [ ] JSON format used for all logs
- [ ] Standard fields defined (timestamp, level, message)
- [ ] Correlation ID in every log entry
- [ ] Service name included
- [ ] Sensitive data excluded/masked
- [ ] Field names standardized across services
- [ ] Log levels used correctly
- [ ] Stack traces included for errors
- [ ] Log aggregation configured
- [ ] Alerting based on log patterns

## Snippets (Generic)

```
Structured Log Entry:
{
  "timestamp": "2026-01-14T12:00:00.123Z",
  "level": "INFO",
  "message": "User login successful",
  "service": "auth-service",
  "version": "1.2.3",
  "correlation_id": "corr_abc123",
  "user_id": "user_456",
  "duration_ms": 45,
  "request": {
    "method": "POST",
    "path": "/api/login",
    "ip": "192.168.1.1"
  }
}

Error Log Entry:
{
  "timestamp": "2026-01-14T12:00:00.123Z",
  "level": "ERROR",
  "message": "Failed to process order",
  "service": "order-service",
  "correlation_id": "corr_def456",
  "error": {
    "type": "ValidationError",
    "message": "Invalid product ID",
    "stack": "ValidationError: Invalid product ID\n  at ..."
  },
  "order_id": "order_789"
}

Log Levels:
- DEBUG: Detailed dev info (disable in prod)
- INFO: Normal operations, milestones
- WARN: Unexpected but handled situations
- ERROR: Failures requiring attention

Standard Fields:
| Field | Type | Description |
|-------|------|-------------|
| timestamp | string | ISO 8601 with milliseconds |
| level | string | DEBUG, INFO, WARN, ERROR |
| message | string | Human-readable description |
| service | string | Service/app name |
| correlation_id | string | Request tracing ID |
| duration_ms | number | Operation duration |

Logging Setup:
1. Configure JSON formatter
2. Define standard fields
3. Set up logging context/MDC
4. Add sensitive data filters
5. Configure log shipping to aggregator
```

## Sources

- Google SRE Book - Practical Alerting: https://sre.google/sre-book/practical-alerting/
- The 12 Factor App - Logs: https://12factor.net/logs
- ELK Stack Documentation: https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html
- Datadog Logging Best Practices: https://docs.datadoghq.com/logs/
