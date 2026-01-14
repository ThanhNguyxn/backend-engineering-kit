---
id: rel-circuit-breaker
title: Circuit Breaker
tags: [reliability, circuit-breaker, resilience, fault-tolerance]
level: advanced
stacks: [all]
---

# Circuit Breaker

## Problem

When a downstream service fails, continuing to send requests wastes resources, increases latency, and can cause cascading failures. You need to fail fast and allow time for recovery.

## When to use

- Calls to external services
- Database connections under load
- Any dependency that can fail
- Preventing cascade failures
- Protecting shared resources

## Solution

1. **Understand circuit states**
   - **Closed**: Normal operation, requests pass through
   - **Open**: Failures exceeded threshold, fail fast
   - **Half-Open**: Testing if service recovered

2. **Configure thresholds**
   - Failure count/percentage to open
   - Timeout duration for open state
   - Success count to close from half-open

3. **Define failure criteria**
   - HTTP 5xx errors
   - Timeouts
   - Connection failures
   - Exception types

4. **Handle open circuit**
   - Return cached data if available
   - Return degraded response
   - Fail fast with clear error

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Too sensitive thresholds | Tune based on normal error rates |
| Too long open duration | Balance recovery time vs availability |
| Not handling half-open properly | Limit probe requests in half-open |
| Circuit per-instance, not per-dependency | Group by logical dependency |
| No fallback behavior | Always define degraded response |

## Checklist

- [ ] Circuit breaker configured for external calls
- [ ] Failure threshold defined (count/percentage)
- [ ] Open state timeout configured
- [ ] Half-open probe strategy defined
- [ ] Fallback behavior implemented
- [ ] Circuit state metrics exposed
- [ ] Alerts on circuit open events
- [ ] Different circuits per dependency
- [ ] Circuit state logged
- [ ] Recovery behavior tested

## Snippets (Generic)

```
Circuit Breaker States:
     ┌──────────────────────────────────────┐
     │                                      │
     ▼                                      │
  CLOSED ──(failures > threshold)──▶ OPEN  │
     ▲                                │     │
     │                                │     │
     │                         (timeout)    │
     │                                │     │
     │                                ▼     │
     └──(successes > threshold)── HALF-OPEN┘
                                      │
                               (failure)
                                      │
                                      └──▶ OPEN

Configuration Example:
circuit_breaker = CircuitBreaker(
  failure_threshold=5,        # Open after 5 failures
  success_threshold=3,        # Close after 3 successes in half-open
  timeout=30s,                # Time in open state before half-open
  failure_rate_threshold=50%  # Or use percentage
)

Usage Pattern:
def call_external_service():
  if circuit.is_open():
    return fallback_response()
  
  try:
    response = http.get(external_url)
    circuit.record_success()
    return response
  except Exception as e:
    circuit.record_failure()
    if circuit.is_open():
      log.warn("Circuit opened for external_service")
    raise

Fallback Strategies:
- Return cached data
- Return default/empty response
- Call alternative service
- Queue for later processing
- Return error with context

Metrics to Track:
- Circuit state (closed/open/half-open)
- Failure count and rate
- Time spent in each state
- Fallback invocation count
```

## Sources

- Martin Fowler - Circuit Breaker: https://martinfowler.com/bliki/CircuitBreaker.html
- Netflix Hystrix (archived but educational): https://github.com/Netflix/Hystrix/wiki
- Resilience4j Circuit Breaker: https://resilience4j.readme.io/docs/circuitbreaker
- Microsoft Circuit Breaker Pattern: https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker
