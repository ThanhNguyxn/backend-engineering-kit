---
id: rel-timeouts
title: Timeouts
tags: [reliability, timeouts, resilience, latency]
level: intermediate
stacks: [all]
---

# Timeouts

## Problem

Without proper timeouts, a slow or unresponsive service can block resources indefinitely, causing cascading failures, thread pool exhaustion, and system-wide outages.

## When to use

- Any external HTTP calls
- Database queries
- Message queue operations
- File I/O operations
- Any I/O that could hang

## Solution

1. **Set timeouts on all I/O**
   - Connection timeout: Time to establish connection
   - Read/Request timeout: Time waiting for response
   - Total timeout: End-to-end operation time

2. **Choose appropriate values**
   - Based on SLAs and acceptable latency
   - Consider P99 response times
   - Include buffer for retries

3. **Layer timeouts properly**
   - Client → Gateway → Service → Database
   - Inner timeouts < outer timeouts
   - Leave room for processing

4. **Handle timeout errors**
   - Treat as transient failure
   - Consider retry with backoff
   - Log with context for debugging

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
