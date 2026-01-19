---
id: rel-circuit-breaker
title: Circuit Breaker
tags:
  - reliability
  - circuit-breaker
  - resilience
  - fault-tolerance
  - bulkhead
level: advanced
stacks:
  - all
scope: reliability
maturity: stable
version: 2.0.0
sources:
  - https://martinfowler.com/bliki/CircuitBreaker.html
  - https://resilience4j.readme.io/docs/circuitbreaker
  - https://github.com/Netflix/Hystrix/wiki
  - https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker
---

# Circuit Breaker

## Problem

When a downstream service fails, continuing to send requests wastes resources, increases latency, and can cause cascading failures. Without circuit breakers, a single failing dependency can bring down your entire system.

## When to use

- Calls to external services (APIs, databases)
- Microservice-to-microservice communication
- Any dependency that can fail or be slow
- Preventing cascade failures
- Protecting shared resources (connection pools, threads)

## Solution

### 1. Understand Circuit States

```
     ┌───────────────────────────────────────────┐
     │                                           │
     ▼                                           │
  CLOSED ──(failure rate > threshold)──► OPEN   │
     ▲                                    │      │
     │                              (wait time)  │
     │                                    │      │
     │                                    ▼      │
     └──(N successes)────────────── HALF-OPEN ──┘
                                          │
                                    (any failure)
                                          │
                                          └──► OPEN
```

| State | Behavior | Transitions |
|-------|----------|-------------|
| **CLOSED** | Normal operation, requests pass through | → OPEN when failure threshold breached |
| **OPEN** | All requests fail fast immediately | → HALF-OPEN after wait duration |
| **HALF-OPEN** | Limited probe requests allowed | → CLOSED if probes succeed, → OPEN if probe fails |

### 2. Configuration Parameters

| Parameter | Typical Value | Description |
|-----------|---------------|-------------|
| Failure Rate Threshold | 50% | % of failures to open circuit |
| Slow Call Rate Threshold | 100% | % of slow calls to open |
| Slow Call Duration | 2-5s | What counts as "slow" |
| Minimum Calls | 10-20 | Min calls before calculating rate |
| Wait Duration (Open) | 30-60s | Time before trying half-open |
| Permitted Calls (Half-Open) | 3-5 | Probe requests in half-open |
| Sliding Window Size | 10-100 | Calls to consider for rate |

### 3. Implementation Examples

**Resilience4j (Java/Kotlin):**
```java
CircuitBreakerConfig config = CircuitBreakerConfig.custom()
    .failureRateThreshold(50)
    .slowCallRateThreshold(100)
    .slowCallDurationThreshold(Duration.ofSeconds(2))
    .waitDurationInOpenState(Duration.ofSeconds(30))
    .permittedNumberOfCallsInHalfOpenState(3)
    .minimumNumberOfCalls(10)
    .slidingWindowSize(20)
    .build();

CircuitBreaker circuitBreaker = CircuitBreaker.of("backendService", config);

Supplier<String> decoratedSupplier = CircuitBreaker
    .decorateSupplier(circuitBreaker, backendService::call);
```

**Polly (.NET):**
```csharp
var circuitBreakerPolicy = Policy
    .Handle<HttpRequestException>()
    .CircuitBreakerAsync(
        exceptionsAllowedBeforeBreaking: 5,
        durationOfBreak: TimeSpan.FromSeconds(30),
        onBreak: (ex, breakDelay) => Log.Warn("Circuit opened"),
        onReset: () => Log.Info("Circuit closed"),
        onHalfOpen: () => Log.Info("Circuit half-open")
    );
```

**Node.js (opossum):**
```typescript
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(asyncFunction, {
  timeout: 3000,           // 3s timeout
  errorThresholdPercentage: 50,
  resetTimeout: 30000,     // 30s before half-open
  volumeThreshold: 10,     // Min calls before tripping
});

breaker.fallback(() => cachedResponse);
breaker.on('open', () => console.log('Circuit opened'));
```

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
