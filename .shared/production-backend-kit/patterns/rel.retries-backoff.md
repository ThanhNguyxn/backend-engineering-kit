---
id: rel-retries-backoff
title: Retries with Exponential Backoff
tags:
  - reliability
  - retries
  - backoff
  - resilience
  - jitter
level: intermediate
stacks:
  - all
scope: reliability
maturity: stable
version: 2.0.0
sources:
  - https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
  - https://cloud.google.com/iot/docs/how-tos/exponential-backoff
  - https://docs.microsoft.com/en-us/azure/architecture/patterns/retry
---

# Retries with Exponential Backoff

## Problem

Transient failures (network blips, temporary overload) cause unnecessary errors if not retried. But aggressive retries without backoff create thundering herd problems that worsen outages and prevent recovery.

## When to use

- Network calls to external services
- Database connection failures
- Distributed system communication
- Idempotent operations only
- Queue message processing
- Any I/O that may fail transiently

## Solution

### 1. Exponential Backoff Algorithm

```
delay = min(maxDelay, baseDelay * 2^attempt)
```

| Attempt | Base 100ms | Base 1s |
|---------|------------|----------|
| 1 | 100ms | 1s |
| 2 | 200ms | 2s |
| 3 | 400ms | 4s |
| 4 | 800ms | 8s |
| 5 | 1600ms | 16s |

### 2. Add Jitter (Critical!)

Without jitter, all clients retry at the same time (thundering herd).

| Jitter Type | Formula | Use Case |
|-------------|---------|----------|
| **Full Jitter** | `random(0, delay)` | Most cases |
| **Equal Jitter** | `delay/2 + random(0, delay/2)` | Guaranteed minimum wait |
| **Decorrelated** | `min(cap, random(base, prevDelay * 3))` | AWS recommended |

**Full Jitter (Recommended):**
```typescript
function fullJitterBackoff(
  attempt: number,
  baseDelay: number = 100,
  maxDelay: number = 60000
): number {
  const expDelay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
  return Math.random() * expDelay;
}
```

**Decorrelated Jitter (AWS):**
```typescript
let prevDelay = baseDelay;
function decorrelatedJitter(): number {
  prevDelay = Math.min(maxDelay, random(baseDelay, prevDelay * 3));
  return prevDelay;
}
```

### 3. Identify Retryable Errors

| Retry | Don't Retry |
|-------|-------------|
| 500 Internal Server Error | 400 Bad Request |
| 502 Bad Gateway | 401 Unauthorized |
| 503 Service Unavailable | 403 Forbidden |
| 504 Gateway Timeout | 404 Not Found |
| 429 Too Many Requests | 409 Conflict |
| Connection timeout | 422 Unprocessable |
| DNS resolution failure | Business logic errors |

### 4. Respect Retry-After Header

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30

HTTP/1.1 503 Service Unavailable
Retry-After: Wed, 21 Oct 2026 07:28:00 GMT
```

```typescript
function getRetryDelay(response: Response, calculatedDelay: number): number {
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) return seconds * 1000;
    const date = Date.parse(retryAfter);
    if (!isNaN(date)) return date - Date.now();
  }
  return calculatedDelay;
}
```

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
