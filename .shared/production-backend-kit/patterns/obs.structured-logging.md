---
id: obs-structured-logging
title: Structured Logging
tags: [observability, logging, json, debugging]
level: beginner
stacks: [all]
---

# Structured Logging

## Problem

Unstructured log messages are hard to parse, search, and analyze. Free-form text logs make automated monitoring and alerting nearly impossible at scale.

## When to use

- All production applications
- Microservices environments
- Any system requiring log analysis
- When using log aggregation (ELK, Datadog)
- Debugging distributed systems

## Solution

1. **Use JSON format**
   - Key-value pairs instead of free text
   - Consistent field names across services
   - Machine-parseable

2. **Include standard fields**
   - Timestamp (ISO 8601)
   - Level (INFO, WARN, ERROR)
   - Message (human-readable)
   - Service name
   - Correlation ID

3. **Add contextual data**
   - User ID (where appropriate)
   - Request path, method
   - Duration for operations
   - Error details and stack traces

4. **Handle sensitive data**
   - Never log passwords, tokens
   - Mask PII as needed
   - Define sensitive field list

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
