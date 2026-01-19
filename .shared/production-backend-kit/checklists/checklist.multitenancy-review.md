---
id: checklist.multitenancy-review
title: Multi-Tenancy Review Checklist
tags:
  - checklist
  - multitenancy
  - security
  - saas
scope: security
level: intermediate
maturity: stable
description: Quality gate checklist for multi-tenant SaaS implementations
stacks:
  - all
---

# Multi-Tenancy Review Checklist

Use this checklist to verify your multi-tenant implementation before deployment.

## Tenant Resolution

- [ ] Tenant resolution strategy is documented
- [ ] Tenant ID validated on every request
- [ ] Invalid tenant returns 400/404 (not 500)
- [ ] Tenant context available in middleware

## Data Isolation

- [ ] All tenant tables have `tenant_id` column
- [ ] `tenant_id` columns have indexes
- [ ] ORM middleware or RLS enforces tenant scope
- [ ] JOINs include tenant_id conditions
- [ ] Raw SQL queries filtered by tenant

## Context Propagation

- [ ] AsyncLocalStorage (or equivalent) configured
- [ ] Tenant context in all log entries
- [ ] Background jobs preserve tenant context
- [ ] Webhooks validate tenant ownership
- [ ] Error handlers have tenant context

## Authorization

- [ ] RBAC model implemented (not role checking)
- [ ] Permission checks on all protected routes
- [ ] Resource-level authorization working
- [ ] Feature flags by plan enforced
- [ ] Cross-tenant access denied and logged

## Security

- [ ] Rate limiting per tenant
- [ ] Tenant admin cannot access other tenants
- [ ] API keys scoped to tenant
- [ ] No tenant ID in URLs (prefer headers/JWT)
- [ ] Audit log for sensitive operations

## Billing

- [ ] Stripe webhook signature verified
- [ ] Webhook events processed idempotently
- [ ] Subscription state synced to DB
- [ ] Payment failure handling implemented
- [ ] Plan limits enforced in app

## Testing

- [ ] Unit tests mock tenant context
- [ ] Integration tests use multiple tenants
- [ ] Cross-tenant access tests exist
- [ ] RLS/middleware bypass tests fail

## Monitoring

- [ ] Metrics include tenant dimension
- [ ] Alerts for cross-tenant access attempts
- [ ] Dashboard for tenant health
- [ ] Usage tracking per tenant
