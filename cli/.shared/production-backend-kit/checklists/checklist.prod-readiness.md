---
id: checklist-prod-readiness
title: Production Readiness Checklist
description: Comprehensive checklist before deploying to production
category: checklists
tags:
  - production
  - deployment
  - readiness
  - launch
  - sre
version: 2.0.0
scope: deployment
level: intermediate
maturity: stable
stacks:
  - all
sources:
  - https://sre.google/sre-book/evolving-sre-engagement-model/
  - https://12factor.net/
  - https://aws.amazon.com/architecture/well-architected/
  - https://learn.microsoft.com/en-us/azure/architecture/checklist/dev-ops
---

# Production Readiness Checklist

Complete this checklist before any production deployment. Each section must be reviewed and signed off.

---

## 🔧 Configuration & Environment

### Configuration Management
- [ ] All configs externalized (not hardcoded)
- [ ] Environment-specific configs (dev/staging/prod)
- [ ] Config validation on startup (fail fast)
- [ ] Feature flags for risky changes
- [ ] Config changes don't require redeploy

### Secrets Management
- [ ] Secrets in secret manager (Vault, AWS Secrets Manager)
- [ ] No secrets in environment variables (use injection)
- [ ] No secrets in git history (run git-secrets scan)
- [ ] Secrets rotation procedure documented
- [ ] Different secrets per environment

### Environment Setup
- [ ] Environment parity (staging ≈ production)
- [ ] All TODO/FIXME comments resolved
- [ ] Debug logging disabled in production
- [ ] Verbose error messages disabled

---

## 🧪 Testing & Quality

### Unit & Integration Testing
- [ ] Unit test coverage > 70%
- [ ] Critical paths have integration tests
- [ ] Tests run in CI on every commit
- [ ] No flaky tests in suite
- [ ] Test data is isolated (not shared)

### Performance & Load Testing
- [ ] Load test completed at 2x expected traffic
- [ ] P95/P99 latency within SLO targets
- [ ] Memory leak testing (12+ hour runs)
- [ ] Concurrent user limit determined

### Security Testing
- [ ] SAST (Static Analysis) run - no critical findings
- [ ] DAST (Dynamic Analysis) run - no critical findings
- [ ] Dependency vulnerability scan (Snyk, Dependabot)
- [ ] OWASP Top 10 review completed
- [ ] Penetration test (if applicable)

---

## 📊 Observability (Logs, Metrics, Traces)

### Logging
- [ ] Structured logging (JSON format)
- [ ] Correlation/trace ID in all logs
- [ ] Log levels appropriate (no DEBUG in prod)
- [ ] PII/sensitive data redacted from logs
- [ ] Log aggregation configured (ELK, CloudWatch)

### Metrics
- [ ] RED metrics exposed (Rate, Errors, Duration)
- [ ] USE metrics for resources (Utilization, Saturation, Errors)
- [ ] Business metrics instrumented
- [ ] Prometheus/StatsD endpoint configured
- [ ] Dashboards created and tested

### Tracing
- [ ] Distributed tracing enabled (OpenTelemetry, Jaeger)
- [ ] Trace context propagated across services
- [ ] Sampling rate appropriate for traffic
- [ ] Critical paths have trace coverage

### Alerting
- [ ] Alerts defined for SLO violations
- [ ] Alert thresholds tuned (not too noisy)
- [ ] PagerDuty/OpsGenie integration
- [ ] Alert runbooks linked to alerts
- [ ] Alert fatigue reviewed

---

## 🔒 Security

### Authentication & Authorization
- [ ] Auth mechanism reviewed (JWT, OAuth)
- [ ] Token expiration configured
- [ ] Session management secure
- [ ] RBAC/permissions tested
- [ ] API authentication required for all endpoints

### Data Protection
- [ ] Data encrypted at rest (AES-256)
- [ ] Data encrypted in transit (TLS 1.2+)
- [ ] PII handling compliant (GDPR, CCPA)
- [ ] Data retention policy implemented
- [ ] Backup encryption verified

### Infrastructure Security
- [ ] TLS certificates valid (auto-renewal)
- [ ] Security groups/firewall rules minimal
- [ ] No public access to databases
- [ ] SSH keys rotated/managed
- [ ] Container images scanned

### Input Validation
- [ ] All inputs validated (body, params, query)
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented (output encoding)
- [ ] CSRF protection enabled
- [ ] Rate limiting configured

---

## 🚀 Deployment & Reliability

### Deployment Strategy
- [ ] Zero-downtime deployment configured
- [ ] Blue-green or canary deployment ready
- [ ] Rollback procedure documented and tested
- [ ] Database migrations backward compatible
- [ ] Feature flags for gradual rollout

### Health Checks
- [ ] `/health/live` endpoint (liveness)
- [ ] `/health/ready` endpoint (readiness)
- [ ] `/health/startup` for slow init (if needed)
- [ ] Health checks verify dependencies
- [ ] Kubernetes probes configured

### Resilience
- [ ] Circuit breakers for external calls
- [ ] Retry logic with exponential backoff
- [ ] Timeouts configured for all I/O
- [ ] Graceful shutdown implemented
- [ ] Connection pooling configured

### Capacity
- [ ] Auto-scaling configured and tested
- [ ] Resource limits set (CPU, memory)
- [ ] Connection pool sizes appropriate
- [ ] Queue sizes and backpressure configured
- [ ] Database connection limits known

---

## 📋 Documentation & Operations

### Documentation
- [ ] API documentation up-to-date (OpenAPI)
- [ ] README with setup instructions
- [ ] Architecture diagram current
- [ ] Deployment procedure documented
- [ ] Environment variables documented

### Runbooks & Incident Response
- [ ] Runbook for common issues
- [ ] Incident response procedure defined
- [ ] On-call escalation path clear
- [ ] Post-mortem template ready
- [ ] Service owner identified

### Dependency Management
- [ ] All dependencies pinned (exact versions)
- [ ] License compliance verified
- [ ] Upgrade path for dependencies known
- [ ] Deprecated dependencies identified
- [ ] Third-party SLAs reviewed

---

## ✅ Final Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering Lead | | | |
| Security Review | | | |
| SRE/Operations | | | |
| Product Owner | | | |

---

## Quick Reference: The Twelve-Factor App

| Factor | Description | ✓ |
|--------|-------------|---|
| 1. Codebase | One codebase, many deploys | [ ] |
| 2. Dependencies | Explicitly declare and isolate | [ ] |
| 3. Config | Store config in environment | [ ] |
| 4. Backing Services | Treat as attached resources | [ ] |
| 5. Build/Release/Run | Strictly separate stages | [ ] |
| 6. Processes | Execute as stateless processes | [ ] |
| 7. Port Binding | Export services via port | [ ] |
| 8. Concurrency | Scale out via process model | [ ] |
| 9. Disposability | Fast startup, graceful shutdown | [ ] |
| 10. Dev/Prod Parity | Keep environments similar | [ ] |
| 11. Logs | Treat as event streams | [ ] |
| 12. Admin Processes | Run as one-off processes | [ ] |

---

## Sources

- [Google SRE - Production Readiness Review](https://sre.google/sre-book/evolving-sre-engagement-model/)
- [The Twelve-Factor App](https://12factor.net/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Microsoft DevOps Checklist](https://learn.microsoft.com/en-us/azure/architecture/checklist/dev-ops)
- [OWASP Security Checklist](https://owasp.org/www-project-web-security-testing-guide/)
