---
id: checklist-prod-readiness
title: Production Readiness Checklist
description: Final checklist before deploying to production
category: checklists
tags: [production, deployment, readiness, launch]
version: 1.0.0
---

# Production Readiness Checklist

Complete this checklist before any production deployment.

---

## 🔧 Configuration

- [ ] Environment-specific configs separated from code
- [ ] Secrets stored in secret manager (not env files)
- [ ] Debug/verbose logging disabled
- [ ] Feature flags configured for rollback
- [ ] All TODO/FIXME comments resolved

## 🧪 Testing

- [ ] Unit tests passing with adequate coverage
- [ ] Integration tests passing
- [ ] End-to-end critical paths tested
- [ ] Load/performance testing completed
- [ ] Security scan run (SAST/DAST)

## 📊 Observability

- [ ] Structured logging configured (JSON format)
- [ ] Correlation ID propagated across services
- [ ] Key metrics exposed (RED: rate, errors, duration)
- [ ] Dashboards created for critical metrics
- [ ] Alerts configured with appropriate thresholds

## 🔒 Security

- [ ] Dependencies scanned for vulnerabilities
- [ ] Security review completed
- [ ] TLS certificates valid and auto-renewed
- [ ] Access controls verified
- [ ] Audit logging enabled for sensitive operations

## 🚀 Deployment

- [ ] Rollback plan documented and tested
- [ ] Database migrations reviewed and tested
- [ ] Zero-downtime deployment strategy in place
- [ ] Health check endpoints working
- [ ] CI/CD pipeline green

## 📋 Documentation

- [ ] API documentation up-to-date
- [ ] Runbook for common issues created
- [ ] On-call escalation path defined
- [ ] Architecture diagram current

---

## Sources

- Google Production Readiness Review: https://sre.google/sre-book/evolving-sre-engagement-model/
- AWS Launch Checklist: https://aws.amazon.com/architecture/well-architected/
- The Twelve-Factor App: https://12factor.net/
- Microsoft DevOps Checklist: https://learn.microsoft.com/en-us/azure/architecture/checklist/dev-ops
