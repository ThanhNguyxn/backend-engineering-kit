---
id: obs-metrics-red-use
title: RED & USE Metrics
tags:
  - observability
  - metrics
  - monitoring
  - sre
  - prometheus
level: intermediate
stacks:
  - all
scope: observability
maturity: stable
version: 2.0.0
sources:
  - https://www.weave.works/blog/the-red-method-key-metrics-for-microservices-architecture/
  - https://www.brendangregg.com/usemethod.html
  - https://sre.google/sre-book/monitoring-distributed-systems/
  - https://prometheus.io/docs/practices/naming/
---

# RED & USE Metrics

## Problem

Without standardized metrics, teams measure random things and miss critical signals. You need a consistent framework to monitor service health and diagnose issues quickly. The challenge is knowing what to measure.

## When to use

- All production services (RED)
- Infrastructure monitoring (USE)
- SLO/SLA tracking
- Capacity planning
- On-call dashboards
- Performance debugging

## Solution

### 1. RED Method (Services/Endpoints)

For every service/endpoint, track:

| Metric | What | Why |
|--------|------|-----|
| **R**ate | Requests per second | Traffic volume, scaling needs |
| **E**rrors | Failed requests per second (or %) | Reliability, user impact |
| **D**uration | Latency (p50, p95, p99) | User experience, SLO |

**Prometheus Implementation:**
```prometheus
# Counter - total requests
http_requests_total{method="GET", endpoint="/api/users", status="200"}
http_requests_total{method="GET", endpoint="/api/users", status="500"}

# Histogram - latency distribution
http_request_duration_seconds_bucket{method="GET", endpoint="/api/users", le="0.1"}
http_request_duration_seconds_bucket{method="GET", endpoint="/api/users", le="0.5"}
http_request_duration_seconds_bucket{method="GET", endpoint="/api/users", le="1.0"}
http_request_duration_seconds_bucket{method="GET", endpoint="/api/users", le="+Inf"}

# PromQL Queries
# Request rate
rate(http_requests_total[5m])

# Error rate
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))

# P99 latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

### 2. USE Method (Resources)

For every resource (CPU, memory, disk, network, queues, pools):

| Metric | What | Example |
|--------|------|--------|
| **U**tilization | % time resource is busy | CPU 75%, Disk 40% |
| **S**aturation | Work waiting (queue length) | 50 pending requests |
| **E**rrors | Error count | Disk errors, OOM events |

**Key Resources to Monitor:**

| Resource | Utilization | Saturation | Errors |
|----------|-------------|------------|--------|
| CPU | `cpu_usage_percent` | Run queue length | - |
| Memory | `memory_used_percent` | Swap usage, OOM | OOM kills |
| Disk | `disk_used_percent`, IOPS | I/O wait | Read/write errors |
| Network | Bandwidth % | Socket queue | Packet drops |
| DB Pool | `active_connections / max` | Pending acquisitions | Timeouts |
| Thread Pool | `active_threads / max` | Queue depth | Rejections |

### 3. Connecting to SLOs

```yaml
# Example SLOs
availability:
  target: 99.9%
  metric: 1 - (error_rate)
  window: 30 days

latency:
  target: 95% of requests < 200ms
  metric: histogram_quantile(0.95, latency) < 0.2
  window: 30 days
```

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Too many metrics | Focus on RED/USE first |
| Not tracking percentiles | Always track p50, p95, p99 |
| Alerting on averages | Use percentiles for latency alerts |
| Ignoring saturation | Track queue depths, thread pool usage |
| No baseline | Establish normal ranges before alerting |

## Checklist

- [ ] Request rate tracked per endpoint
- [ ] Error rate tracked per endpoint
- [ ] Latency percentiles tracked (p50, p95, p99)
- [ ] CPU utilization monitored
- [ ] Memory utilization monitored
- [ ] Disk I/O and space monitored
- [ ] Queue depths tracked (saturation)
- [ ] Connection pool utilization tracked
- [ ] Dashboards created for RED and USE
- [ ] Alerts configured with appropriate thresholds

## Snippets (Generic)

```
RED Metrics (per endpoint):
http_requests_total{method="GET", path="/api/users", status="200"} 1000
http_requests_total{method="GET", path="/api/users", status="500"} 5
http_request_duration_seconds{method="GET", path="/api/users", quantile="0.50"} 0.05
http_request_duration_seconds{method="GET", path="/api/users", quantile="0.95"} 0.2
http_request_duration_seconds{method="GET", path="/api/users", quantile="0.99"} 0.5

USE Metrics (per resource):
# CPU
cpu_utilization_percent 75
cpu_saturation (runnable processes waiting) 2

# Memory
memory_utilization_percent 60
memory_saturation (swap usage) 0

# Disk
disk_utilization_percent 40
disk_io_wait_seconds 0.01

# Connection Pool
pool_utilization_percent 80
pool_pending_requests 5
pool_errors_total 0

Dashboard Layout:
┌─────────────────────────────────────────┐
│ SERVICE RED METRICS                     │
├─────────────┬─────────────┬─────────────┤
│ Request Rate│ Error Rate  │ Latency p99 │
│ 1000 req/s  │ 0.5%        │ 200ms       │
└─────────────┴─────────────┴─────────────┘
┌─────────────────────────────────────────┐
│ RESOURCE USE METRICS                    │
├──────┬──────┬──────┬──────┬─────────────┤
│ CPU  │ Mem  │ Disk │ Pool │ Queue Depth │
│ 75%  │ 60%  │ 40%  │ 80%  │ 50 msgs     │
└──────┴──────┴──────┴──────┴─────────────┘

Alerting Thresholds (example):
- Error rate > 1% for 5 min → Page
- p99 latency > 500ms for 10 min → Warn
- CPU utilization > 80% for 15 min → Warn
- Queue depth > 1000 for 5 min → Page
```

## Sources

- RED Method (Tom Wilkie): https://www.weave.works/blog/the-red-method-key-metrics-for-microservices-architecture/
- USE Method (Brendan Gregg): https://www.brendangregg.com/usemethod.html
- Google SRE Book - Monitoring: https://sre.google/sre-book/monitoring-distributed-systems/
- Prometheus Best Practices: https://prometheus.io/docs/practices/naming/
