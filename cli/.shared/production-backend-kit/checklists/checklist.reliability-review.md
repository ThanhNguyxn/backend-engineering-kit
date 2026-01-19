---
id: checklist-reliability-review
title: Reliability Review Checklist
description: Comprehensive reliability and resilience review for distributed systems
category: checklists
tags:
  - reliability
  - resilience
  - sre
  - review
  - fault-tolerance
version: 2.0.0
scope: reliability
level: advanced
maturity: stable
stacks:
  - all
sources:
  - https://sre.google/sre-book/table-of-contents/
  - https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/
  - https://pragprog.com/titles/mnee2/release-it-second-edition/
  - https://learn.microsoft.com/en-us/azure/architecture/framework/resiliency/
---

# Reliability Review Checklist

Use this checklist to assess system reliability before production deployment.

---

## ⏱️ Timeouts

### Connection Timeouts
- [ ] Connection timeout configured for all external HTTP calls
- [ ] Database connection timeout set
- [ ] Redis/cache connection timeout set
- [ ] Message broker connection timeout set
- [ ] Default: 1-5s for connection, longer for read

### Request/Operation Timeouts
- [ ] Read/request timeout configured for HTTP calls
- [ ] Database query timeout configured
- [ ] Overall transaction timeout defined
- [ ] Async operation timeouts (Future/Promise)

### Timeout Hierarchy
- [ ] Inner timeouts shorter than outer timeouts
- [ ] Gateway timeout > service timeout > database timeout
- [ ] Client timeout > server timeout (avoid orphaned requests)
- [ ] Timeouts documented and justified

### Timeout Values Reference
| Operation | Typical Range |
|-----------|---------------|
| Connection | 1-5s |
| API call (internal) | 1-10s |
| API call (external) | 5-30s |
| Database query | 5-30s |
| Batch operation | 30s-5min |
| Background job | 1min-1hr |

---

## 🔄 Retry Strategy

### Basic Configuration
- [ ] Retry enabled only for transient errors (5xx, network)
- [ ] Retry disabled for client errors (4xx)
- [ ] Maximum retry count defined (typically 3-5)
- [ ] Total retry duration bounded (budget approach)

### Exponential Backoff
- [ ] Exponential backoff implemented (not fixed delay)
- [ ] Jitter added to prevent thundering herd
- [ ] Base delay appropriate (100ms - 1s)
- [ ] Max delay capped (30s - 60s typical)

### Idempotency for Retries
- [ ] Write operations use idempotency keys
- [ ] Retry-safe operations identified
- [ ] Non-idempotent operations have guards

```
// Recommended backoff formula
delay = min(maxDelay, baseDelay * 2^attempt + randomJitter)
```

---

## 🔌 Circuit Breakers

### Configuration
- [ ] Circuit breaker for all external dependencies
- [ ] Failure threshold defined (e.g., 50% in 10s window)
- [ ] Minimum request count before tripping (e.g., 10)
- [ ] Open duration appropriate (15-60s typical)

### States & Transitions
- [ ] CLOSED → OPEN on threshold breach
- [ ] OPEN → HALF-OPEN after timeout
- [ ] HALF-OPEN → CLOSED on success probe
- [ ] HALF-OPEN → OPEN on probe failure

### Recovery
- [ ] Half-open probe requests limited (1-3)
- [ ] Gradual traffic increase after recovery
- [ ] Fallback response when circuit open
- [ ] Fallback distinguishable from real response

### Observability
- [ ] Circuit state exposed in metrics
- [ ] Circuit state changes logged
- [ ] Dashboard shows circuit health
- [ ] Alerts on prolonged open state

---

## 📨 Messaging & Async Processing

### Dead Letter Queue (DLQ)
- [ ] DLQ configured for every queue
- [ ] Failed messages retain original context
- [ ] DLQ monitoring and alerting
- [ ] DLQ replay mechanism exists
- [ ] Retention policy for DLQ messages

### Idempotent Consumers
- [ ] Message processing is idempotent
- [ ] Deduplication key tracked (message ID)
- [ ] Exactly-once semantics where required
- [ ] At-least-once acceptable with idempotency

### Poison Message Handling
- [ ] Max retry attempts per message (3-5)
- [ ] Messages move to DLQ after max retries
- [ ] Bad message doesn't block queue
- [ ] Message schema validation at entry

### Ordering & Delivery
- [ ] Ordering preserved where required (partition key)
- [ ] Out-of-order handling for eventual consistency
- [ ] Duplicate delivery handling
- [ ] Message TTL configured

### Queue Health
- [ ] Queue depth monitored (messages pending)
- [ ] Consumer lag monitored
- [ ] Alert on growing backlog
- [ ] Auto-scaling based on queue depth

---

## 🛡️ Graceful Degradation

### Feature Toggles
- [ ] Non-critical features can be disabled
- [ ] Kill switches for expensive operations
- [ ] Feature flags externally configurable
- [ ] No deploy needed to toggle

### Caching Fallback
- [ ] Stale cache served when source unavailable
- [ ] Cache-aside pattern with TTL
- [ ] Cache stampede prevention (locking)
- [ ] Local cache as backup for remote cache

### Load Shedding
- [ ] Request prioritization implemented
- [ ] Low-priority requests shed under load
- [ ] Client-provided priority respected
- [ ] Shedding threshold configured

### Bulkhead Pattern
- [ ] Resource pools isolated per dependency
- [ ] Failure in one dependency doesn't exhaust shared resources
- [ ] Thread pools / connection pools separated
- [ ] Semaphore limits for concurrent operations

---

## ❤️ Health Checks

### Liveness Probe
- [ ] `/health/live` endpoint exists
- [ ] Returns 200 if process is alive
- [ ] Minimal logic (no dependency checks)
- [ ] Fails only when restart would help

### Readiness Probe
- [ ] `/health/ready` endpoint exists
- [ ] Checks critical dependencies (DB, cache)
- [ ] Returns 503 when not ready for traffic
- [ ] Timeout-protected dependency checks

### Startup Probe (if slow startup)
- [ ] `/health/startup` endpoint exists
- [ ] Allows longer initial startup time
- [ ] Prevents premature liveness failures

### Kubernetes Configuration
- [ ] `initialDelaySeconds` appropriate
- [ ] `periodSeconds` not too aggressive
- [ ] `failureThreshold` allows transient failures
- [ ] `timeoutSeconds` less than `periodSeconds`

---

## 🔄 Graceful Shutdown

### Signal Handling
- [ ] SIGTERM handled (not SIGKILL)
- [ ] Graceful shutdown period defined (15-30s)
- [ ] In-flight requests allowed to complete
- [ ] New requests rejected during shutdown

### Resource Cleanup
- [ ] Database connections drained
- [ ] Message consumer stopped (no new messages)
- [ ] Background jobs completed or checkpointed
- [ ] Cron jobs paused

### Kubernetes Integration
- [ ] `preStop` hook if needed (sleep for load balancer)
- [ ] `terminationGracePeriodSeconds` matches app needs
- [ ] Readiness probe fails during shutdown

```yaml
# Kubernetes example
lifecycle:
  preStop:
    exec:
      command: ["/bin/sh", "-c", "sleep 5"]
terminationGracePeriodSeconds: 30
```

---

## 📊 Capacity Planning

### Auto-Scaling
- [ ] Horizontal auto-scaling configured
- [ ] Scale-up trigger appropriate (70-80% CPU/memory)
- [ ] Scale-down delay prevents flapping
- [ ] Min/max instances defined
- [ ] Scale-out tested under load

### Resource Limits
- [ ] CPU request and limit set
- [ ] Memory request and limit set
- [ ] OOM behavior acceptable (restart vs OOMKilled)
- [ ] Disk/storage limits if applicable

### Connection Pools
- [ ] Database pool size calculated
  - Formula: `connections = ((core_count * 2) + effective_spindle_count)`
- [ ] HTTP client pool size appropriate
- [ ] Pool exhaustion handled gracefully
- [ ] Pool metrics exposed

### Load Testing
- [ ] Load tested at expected peak traffic
- [ ] Tested at 2x expected peak
- [ ] Failure mode under overload documented
- [ ] Recovery after overload verified

---

## 🔄 Consistency & Data

### Eventual Consistency
- [ ] Inconsistency windows documented
- [ ] Reconciliation process exists
- [ ] Client UX handles lag gracefully

### Outbox Pattern (if applicable)
- [ ] Messages written transactionally with data
- [ ] Relay process publishes from outbox
- [ ] At-least-once delivery guaranteed
- [ ] Duplicate handling at consumer

### Saga Pattern (if distributed)
- [ ] Compensating transactions defined
- [ ] Saga state persisted
- [ ] Partial failure recovery documented

---

## ✅ Reliability Summary

| Category | Status | Notes |
|----------|--------|-------|
| Timeouts | [ ] | |
| Retries | [ ] | |
| Circuit Breakers | [ ] | |
| DLQ/Messaging | [ ] | |
| Graceful Degradation | [ ] | |
| Health Checks | [ ] | |
| Graceful Shutdown | [ ] | |
| Capacity/Scaling | [ ] | |

---

## Sign-Off

| Role | Name | Date |
|------|------|------|
| SRE/Operations | | |
| Development Lead | | |

---

## Sources

- [Google SRE Book](https://sre.google/sre-book/table-of-contents/)
- [AWS Well-Architected - Reliability Pillar](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/)
- [Release It! 2nd Edition (Nygard)](https://pragprog.com/titles/mnee2/release-it-second-edition/)
- [Microsoft Azure - Resiliency Checklist](https://learn.microsoft.com/en-us/azure/architecture/framework/resiliency/)
- [Martin Fowler - Circuit Breaker](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Netflix - Hystrix](https://github.com/Netflix/Hystrix/wiki)
