---
id: checklist-reliability-review
title: Reliability Review Checklist
description: Reliability and resilience review for distributed systems
category: checklists
tags: [reliability, resilience, sre, review]
version: 1.0.0
---

# Reliability Review Checklist

Use this checklist to assess system reliability before production deployment.

---

## ⏱️ Timeouts & Retries

- [ ] Connection timeout configured for all external calls
- [ ] Read/request timeout configured
- [ ] Inner timeouts shorter than outer timeouts
- [ ] Retry logic uses exponential backoff with jitter
- [ ] Maximum retry count defined
- [ ] Only transient errors trigger retries

## 🔌 Circuit Breakers

- [ ] Circuit breaker configured for external dependencies
- [ ] Failure threshold defined (count or percentage)
- [ ] Half-open probe strategy implemented
- [ ] Fallback response available when circuit open
- [ ] Circuit state visible in metrics

## 📨 Messaging & Queues

- [ ] Dead letter queue configured
- [ ] Message consumers are idempotent
- [ ] Poison message handling in place
- [ ] Message ordering preserved where required
- [ ] Queue depth monitored and alerted

## 🔄 Graceful Degradation

- [ ] Non-critical features can be disabled
- [ ] Cached data served when source unavailable
- [ ] Load shedding implemented for overload
- [ ] Health check endpoints available
- [ ] Startup/shutdown hooks handle in-flight requests

## 📊 Capacity

- [ ] Auto-scaling configured (if applicable)
- [ ] Resource limits set (CPU, memory)
- [ ] Connection pools sized appropriately
- [ ] Load tested with expected peak traffic

---

## Sources

- Google SRE Book: https://sre.google/sre-book/table-of-contents/
- AWS Well-Architected - Reliability: https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/
- Release It! (Nygard): https://pragprog.com/titles/mnee2/release-it-second-edition/
