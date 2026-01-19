---
id: obs-alerting-strategies
title: Alerting Strategies & Best Practices
tags:
  - observability
  - alerting
  - monitoring
  - sre
  - on-call
level: intermediate
stacks:
  - all
scope: observability
maturity: stable
version: 2.0.0
sources:
  - https://sre.google/sre-book/monitoring-distributed-systems/
  - https://sre.google/workbook/alerting-on-slos/
  - https://docs.datadoghq.com/monitors/guide/alert-on-no-change-in-value/
  - https://prometheus.io/docs/practices/alerting/
---

# Alerting Strategies & Best Practices

## Problem

Poor alerting leads to:
- **Alert fatigue**: Too many alerts → engineers ignore them all
- **Missed incidents**: Not alerting on what matters
- **Slow response**: Unclear alerts delay diagnosis
- **Burnout**: Constant pages for non-issues
- **Over-engineering**: Alerts on every metric

**"The only purpose of an alert is to bring a human into the loop."**
— Google SRE Book

## When to use

- Any production system
- SLO/SLI-based monitoring
- On-call rotations
- Business-critical services
- Infrastructure monitoring

## Solution

### 1. Alert Philosophy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ALERTING PRINCIPLES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ✓ Alert on SYMPTOMS, not causes                                           │
│    Bad:  "CPU > 80%"                                                        │
│    Good: "Error rate > 1%" or "Latency p99 > 500ms"                        │
│                                                                             │
│  ✓ Alert on USER IMPACT                                                    │
│    Bad:  "Pod restarted"                                                    │
│    Good: "Users seeing errors" or "Checkout failures increasing"            │
│                                                                             │
│  ✓ Alert should be ACTIONABLE                                              │
│    Ask: "What will the on-call DO when paged?"                              │
│    If no action needed → don't alert                                        │
│                                                                             │
│  ✓ Every alert needs a RUNBOOK                                             │
│    Clear steps to diagnose and mitigate                                     │
│                                                                             │
│  ✓ Alerts should be URGENT                                                 │
│    Page: Requires immediate human action                                    │
│    Ticket: Can wait until business hours                                    │
│    Log: Informational, no action needed                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. SLO-Based Alerting (Recommended)

```yaml
# Alert when burning through error budget too fast
# This is the modern, recommended approach

# SLO: 99.9% availability over 30 days
# Error budget: 0.1% = 43.2 minutes/month

# Multi-window, multi-burn-rate alerts
groups:
  - name: slo-alerts
    rules:
      # Fast burn: 14.4x burn rate over 1 hour
      # Will exhaust budget in ~2 days
      - alert: HighErrorBudgetBurn_Fast
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[1h]))
            / sum(rate(http_requests_total[1h]))
          ) > (14.4 * 0.001)
          and
          (
            sum(rate(http_requests_total{status=~"5.."}[5m]))
            / sum(rate(http_requests_total[5m]))
          ) > (14.4 * 0.001)
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate - burning error budget fast"
          description: "Error rate is {{ $value | humanizePercentage }}, consuming error budget at 14x normal rate"
          runbook_url: "https://runbooks.example.com/high-error-rate"
          dashboard: "https://grafana.example.com/d/slo-dashboard"

      # Slow burn: 3x burn rate over 3 days
      # Will exhaust budget in ~10 days
      - alert: HighErrorBudgetBurn_Slow
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[3d]))
            / sum(rate(http_requests_total[3d]))
          ) > (3 * 0.001)
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Elevated error rate - slowly burning error budget"
          description: "Error rate elevated for extended period"
```

### 3. Alert Severity Levels

```typescript
// Define clear severity levels
enum AlertSeverity {
  CRITICAL = 'critical',  // Page immediately, 24/7
  WARNING = 'warning',    // Page during business hours, or ticket
  INFO = 'info',          // Log, no notification
}

interface AlertDefinition {
  name: string;
  severity: AlertSeverity;
  condition: string;
  duration: string;       // How long condition must be true
  runbookUrl: string;
  notificationChannels: string[];
  autoResolve: boolean;
}

const alerts: AlertDefinition[] = [
  // CRITICAL: Immediate page
  {
    name: 'ServiceDown',
    severity: AlertSeverity.CRITICAL,
    condition: 'up == 0',
    duration: '1m',
    runbookUrl: 'https://runbooks/service-down',
    notificationChannels: ['pagerduty', 'slack-critical'],
    autoResolve: true,
  },
  {
    name: 'HighErrorRate',
    severity: AlertSeverity.CRITICAL,
    condition: 'error_rate > 0.05', // 5% errors
    duration: '5m',
    runbookUrl: 'https://runbooks/high-errors',
    notificationChannels: ['pagerduty', 'slack-critical'],
    autoResolve: true,
  },
  
  // WARNING: Business hours or ticket
  {
    name: 'ElevatedLatency',
    severity: AlertSeverity.WARNING,
    condition: 'p99_latency > 1000', // 1 second
    duration: '15m',
    runbookUrl: 'https://runbooks/high-latency',
    notificationChannels: ['slack-warnings', 'ticket'],
    autoResolve: true,
  },
  {
    name: 'DiskSpaceLow',
    severity: AlertSeverity.WARNING,
    condition: 'disk_used_percent > 80',
    duration: '30m',
    runbookUrl: 'https://runbooks/disk-space',
    notificationChannels: ['slack-warnings'],
    autoResolve: true,
  },
  
  // INFO: Log only
  {
    name: 'DeploymentStarted',
    severity: AlertSeverity.INFO,
    condition: 'deployment_in_progress == 1',
    duration: '0m',
    runbookUrl: '',
    notificationChannels: ['slack-deployments'],
    autoResolve: true,
  },
];
```

### 4. Alert Content Template

```yaml
# Good alert has all context needed
- alert: PaymentServiceErrors
  expr: |
    sum(rate(payment_requests_total{status="error"}[5m])) 
    / sum(rate(payment_requests_total[5m])) > 0.01
  for: 5m
  labels:
    severity: critical
    team: payments
    service: payment-service
  annotations:
    # Short, scannable summary
    summary: "Payment service error rate > 1%"
    
    # Detailed description with current value
    description: |
      Payment service error rate is {{ $value | humanizePercentage }}.
      This affects customer checkout flow.
      
      Triggered at: {{ .StartsAt }}
      Current value: {{ $value | humanizePercentage }}
    
    # Impact statement
    impact: "Customers may be unable to complete purchases"
    
    # Direct links to everything needed
    runbook_url: "https://runbooks.example.com/payment-errors"
    dashboard_url: "https://grafana.example.com/d/payments?from=now-1h"
    logs_url: "https://logs.example.com/search?query=service:payment+level:error"
    
    # Who to escalate to
    escalation: "payments-oncall → payments-lead → vp-engineering"
```

### 5. Prometheus Alert Examples

```yaml
groups:
  - name: application-alerts
    rules:
      # Availability alert
      - alert: ServiceUnavailable
        expr: up{job="api-server"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.instance }} is down"
          runbook_url: "https://runbooks/service-down"

      # Error rate alert (symptom-based)
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
          / sum(rate(http_requests_total[5m])) by (service) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on {{ $labels.service }}"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # Latency alert (symptom-based)
      - alert: HighLatency
        expr: |
          histogram_quantile(0.99, 
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service)
          ) > 1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High latency on {{ $labels.service }}"
          description: "p99 latency is {{ $value | humanizeDuration }}"

      # Saturation alert
      - alert: HighMemoryUsage
        expr: |
          (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes)
          / node_memory_MemTotal_bytes > 0.9
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on {{ $labels.instance }}"
          description: "Memory usage is {{ $value | humanizePercentage }}"

      # Queue depth (leading indicator)
      - alert: HighQueueDepth
        expr: |
          sum(rabbitmq_queue_messages) by (queue) > 10000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Queue {{ $labels.queue }} backing up"
          description: "{{ $value }} messages in queue"

      # Certificate expiry (proactive)
      - alert: CertificateExpiringSoon
        expr: |
          (probe_ssl_earliest_cert_expiry - time()) / 86400 < 14
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "SSL certificate expiring soon"
          description: "Certificate for {{ $labels.instance }} expires in {{ $value | humanize }} days"

  - name: business-alerts
    rules:
      # Business metric alert
      - alert: LowConversionRate
        expr: |
          sum(rate(checkout_completed_total[1h]))
          / sum(rate(checkout_started_total[1h])) < 0.3
        for: 30m
        labels:
          severity: warning
          team: product
        annotations:
          summary: "Checkout conversion rate dropped below 30%"

      # Revenue alert
      - alert: RevenueAnomaly
        expr: |
          abs(
            sum(rate(order_total_usd[1h]))
            - sum(rate(order_total_usd[1h] offset 1d))
          ) / sum(rate(order_total_usd[1h] offset 1d)) > 0.5
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Revenue changed by more than 50% vs yesterday"
```

### 6. Alert Routing & Escalation

```yaml
# Alertmanager configuration
global:
  resolve_timeout: 5m
  slack_api_url: 'https://hooks.slack.com/services/xxx'
  pagerduty_url: 'https://events.pagerduty.com/v2/enqueue'

route:
  # Default route
  receiver: 'slack-default'
  group_by: ['alertname', 'service']
  group_wait: 30s      # Wait before first notification
  group_interval: 5m   # Time between grouped notifications
  repeat_interval: 4h  # How often to re-send
  
  routes:
    # Critical → PagerDuty immediately
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
      group_wait: 10s
      repeat_interval: 1h
      
    # Payments team critical → dedicated PagerDuty
    - match:
        severity: critical
        team: payments
      receiver: 'pagerduty-payments'
      
    # Warnings → Slack during business hours
    - match:
        severity: warning
      receiver: 'slack-warnings'
      active_time_intervals:
        - business-hours
      
    # Security alerts → immediate + security channel
    - match:
        category: security
      receiver: 'security-team'
      group_wait: 0s

receivers:
  - name: 'slack-default'
    slack_configs:
      - channel: '#alerts'
        send_resolved: true
        title: '{{ .Status | toUpper }}: {{ .CommonAnnotations.summary }}'
        text: '{{ .CommonAnnotations.description }}'
        
  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: 'xxx'
        severity: critical
        description: '{{ .CommonAnnotations.summary }}'
        details:
          runbook: '{{ .CommonAnnotations.runbook_url }}'
          dashboard: '{{ .CommonAnnotations.dashboard_url }}'

  - name: 'slack-warnings'
    slack_configs:
      - channel: '#alerts-warnings'
        send_resolved: true

time_intervals:
  - name: business-hours
    time_intervals:
      - weekdays: ['monday:friday']
        times:
          - start_time: '09:00'
            end_time: '18:00'

# Inhibition rules - suppress related alerts
inhibit_rules:
  # If service is down, don't alert on latency
  - source_match:
      alertname: ServiceUnavailable
    target_match:
      alertname: HighLatency
    equal: ['service']
    
  # If cluster is down, don't alert on individual nodes
  - source_match:
      alertname: ClusterDown
    target_match_re:
      alertname: 'Node.*'
    equal: ['cluster']
```

### 7. Alert Testing & Validation

```typescript
// Test alerts before deploying
import { PrometheusRulesValidator } from 'prom-rules-validator';

describe('Alert Rules', () => {
  const validator = new PrometheusRulesValidator();
  
  it('should have valid syntax', async () => {
    const result = await validator.validate('./alerts/*.yaml');
    expect(result.errors).toHaveLength(0);
  });
  
  it('should have required annotations', async () => {
    const rules = await loadAlertRules('./alerts/*.yaml');
    
    for (const rule of rules) {
      expect(rule.annotations).toHaveProperty('summary');
      expect(rule.annotations).toHaveProperty('runbook_url');
      expect(rule.annotations.runbook_url).toMatch(/^https:\/\//);
    }
  });
  
  it('should have valid severity labels', async () => {
    const rules = await loadAlertRules('./alerts/*.yaml');
    const validSeverities = ['critical', 'warning', 'info'];
    
    for (const rule of rules) {
      expect(validSeverities).toContain(rule.labels.severity);
    }
  });
  
  it('critical alerts should have PagerDuty routing', async () => {
    const config = await loadAlertmanagerConfig();
    const criticalRoute = config.route.routes.find(
      r => r.match?.severity === 'critical'
    );
    
    expect(criticalRoute?.receiver).toContain('pagerduty');
  });
});

// Chaos testing for alerts
describe('Alert Triggers', () => {
  it('should fire HighErrorRate when errors spike', async () => {
    // Inject errors
    await injectErrors({ rate: 0.1, duration: '10m' });
    
    // Wait for alert
    const alert = await waitForAlert('HighErrorRate', { timeout: '15m' });
    expect(alert).toBeTruthy();
    expect(alert.labels.severity).toBe('critical');
  });
});
```

### 8. Alert Hygiene & Review

```typescript
// Weekly alert review metrics
interface AlertMetrics {
  totalAlerts: number;
  uniqueAlerts: number;
  meanTimeToAcknowledge: number;
  meanTimeToResolve: number;
  falsePositiveRate: number;
  alertsPerOnCall: number;
  noisyAlerts: string[];  // Alerts that fired > 10 times
  staleAlerts: string[];  // Alerts that never fired
}

async function generateAlertReport(period: string): Promise<AlertMetrics> {
  const alerts = await queryAlertHistory(period);
  
  // Find noisy alerts (alert fatigue candidates)
  const alertCounts = countBy(alerts, 'alertname');
  const noisyAlerts = Object.entries(alertCounts)
    .filter(([_, count]) => count > 10)
    .map(([name]) => name);
  
  // Find stale alerts (never fired in period)
  const allDefinedAlerts = await getAllAlertRules();
  const firedAlerts = new Set(alerts.map(a => a.alertname));
  const staleAlerts = allDefinedAlerts.filter(a => !firedAlerts.has(a.name));
  
  return {
    totalAlerts: alerts.length,
    uniqueAlerts: new Set(alerts.map(a => a.alertname)).size,
    meanTimeToAcknowledge: calculateMTTA(alerts),
    meanTimeToResolve: calculateMTTR(alerts),
    falsePositiveRate: calculateFalsePositiveRate(alerts),
    alertsPerOnCall: alerts.length / getOnCallRotationCount(period),
    noisyAlerts,
    staleAlerts: staleAlerts.map(a => a.name),
  };
}

// Monthly alert review checklist
const alertReviewChecklist = [
  '[ ] Review noisy alerts - tune thresholds or delete',
  '[ ] Review stale alerts - still needed?',
  '[ ] Check false positive rate - should be < 5%',
  '[ ] Verify all runbooks are up to date',
  '[ ] Check escalation paths are correct',
  '[ ] Review on-call feedback from past month',
  '[ ] Update SLO thresholds if needed',
];
```

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| Alerting on causes not symptoms | Miss real issues, false positives | Alert on user-facing metrics |
| No runbooks | Slow incident response | Every alert needs runbook |
| Too many alerts | Alert fatigue, ignored pages | Strict alert review process |
| Same severity for everything | Can't prioritize | Clear severity definitions |
| Not testing alerts | Alerts don't fire when needed | Regular alert testing |
| No auto-resolve | Manual work to close alerts | Configure auto-resolution |
| Alerting on metrics, not SLOs | Chasing causes | Use SLO-based alerting |
| No grouping | Alert storms | Configure proper grouping |

## Checklist

- [ ] Alerts on symptoms, not causes
- [ ] SLO-based alerting implemented
- [ ] Clear severity levels defined
- [ ] Every alert has runbook URL
- [ ] Alerts include dashboard links
- [ ] Routing to correct teams configured
- [ ] Escalation paths defined
- [ ] Business-hours routing for warnings
- [ ] Alert grouping configured
- [ ] Inhibition rules for related alerts
- [ ] False positive rate tracked
- [ ] Monthly alert review scheduled
- [ ] On-call rotation documented
- [ ] Alert testing in CI/CD

## References

- [Google SRE Book - Monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)
- [Google SRE Workbook - Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)
- [Prometheus Alerting Best Practices](https://prometheus.io/docs/practices/alerting/)
- [Alertmanager Configuration](https://prometheus.io/docs/alerting/latest/configuration/)
- [PagerDuty Incident Response](https://response.pagerduty.com/)
