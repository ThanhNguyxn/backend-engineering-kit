---
id: rel-retries-backoff
title: Retries with Backoff
tags: [reliability, retries, backoff, resilience]
level: intermediate
stacks: [all]
---

# Retries with Backoff

## Problem

Transient failures (network blips, temporary overload) cause unnecessary errors if not retried. But aggressive retries without backoff create thundering herd problems that worsen outages.

## When to use

- Network calls to external services
- Database connection failures
- Distributed system communication
- Idempotent operations
- Queue message processing

## Solution

1. **Implement exponential backoff**
   - Double delay between retries
   - Start with small delay (100-500ms)
   - Cap maximum delay (30-60s)

2. **Add jitter**
   - Randomize delay to prevent thundering herd
   - Full jitter or decorrelated jitter
   - Spreads retry load over time

3. **Limit retry attempts**
   - Set maximum retry count (3-5 typical)
   - Or maximum total time budget
   - Fail after exhausting retries

4. **Identify retryable errors**
   - 503 Service Unavailable
   - 429 Too Many Requests
   - Connection timeouts
   - Rate limit errors
   - NOT: 400 Bad Request, 404 Not Found

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Retrying non-idempotent ops | Only retry safe/idempotent operations |
| No jitter (thundering herd) | Always add random jitter |
| Retrying client errors (4xx) | Only retry transient/server errors |
| Unbounded retries | Set max attempts or time budget |
| Ignoring Retry-After header | Respect server guidance |

## Checklist

- [ ] Exponential backoff implemented
- [ ] Random jitter added
- [ ] Maximum retry count configured
- [ ] Only transient errors retried
- [ ] Retry-After header respected
- [ ] Total retry budget defined
- [ ] Idempotency ensured for retry
- [ ] Retry metrics tracked
- [ ] Final failure handled gracefully
- [ ] Retry logic tested

## Snippets (Generic)

```
Exponential Backoff with Jitter:
base_delay = 100ms
max_delay = 60s
max_attempts = 5

for attempt in 1..max_attempts:
  try:
    return make_request()
  except RetryableError:
    if attempt == max_attempts:
      raise
    
    # Exponential: 100ms, 200ms, 400ms, 800ms, 1600ms...
    exp_delay = base_delay * (2 ^ (attempt - 1))
    
    # Cap at maximum
    delay = min(exp_delay, max_delay)
    
    # Add jitter (full jitter)
    jitter_delay = random(0, delay)
    
    sleep(jitter_delay)

Jitter Strategies:
- Full jitter: random(0, delay)
- Equal jitter: delay/2 + random(0, delay/2)
- Decorrelated jitter: min(cap, random(base, prev_delay * 3))

Retryable vs Non-Retryable:
Retry:
  - 500, 502, 503, 504 (server errors)
  - 429 (rate limit - respect Retry-After)
  - Connection timeout
  - Network errors

Don't Retry:
  - 400 (bad request)
  - 401, 403 (auth errors)
  - 404 (not found)
  - 422 (validation)

Retry-After Header:
HTTP/1.1 429 Too Many Requests
Retry-After: 30

# Wait at least 30 seconds before retry
```

## Sources

- AWS Exponential Backoff and Jitter: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
- Google API Client Retry: https://cloud.google.com/storage/docs/retry-strategy
- Azure Retry Guidance: https://learn.microsoft.com/en-us/azure/architecture/best-practices/retry-service-specific
- Polly .NET Resilience: https://github.com/App-vNext/Polly
