---
id: obs-metrics-red-use
title: RED & USE Metrics
tags: [observability, metrics, monitoring, sre]
level: intermediate
stacks: [all]
---

# RED & USE Metrics

## Problem

Without standardized metrics, teams measure random things and miss critical signals. You need a consistent framework to monitor service health and diagnose issues quickly.

## When to use

- All production services
- API endpoints monitoring
- Infrastructure monitoring
- SLO/SLA tracking
- Capacity planning

## Solution

1. **RED Method (for services/endpoints)**
   - **R**ate: Requests per second
   - **E**rrors: Failed requests per second
   - **D**uration: Latency distribution (p50, p95, p99)

2. **USE Method (for resources)**
   - **U**tilization: How busy is the resource
   - **S**aturation: How much queued/waiting work
   - **E**rrors: Error count for the resource

3. **Implement at right layers**
   - RED: API routes, service methods
   - USE: CPU, memory, disk, network, queues, pools

4. **Set up dashboards & alerts**
   - Primary dashboard with RED metrics
   - Infrastructure dashboard with USE
   - Alert on error rate and latency spikes

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
