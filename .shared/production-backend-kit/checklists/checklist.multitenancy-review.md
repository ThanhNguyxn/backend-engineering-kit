---
id: checklist-multitenancy-review
title: Multi-Tenancy Review Checklist
tags:
  - checklist
  - multitenancy
  - security
  - saas
  - isolation
scope: security
level: advanced
maturity: stable
description: Comprehensive quality gate checklist for multi-tenant SaaS implementations
version: 2.0.0
stacks:
  - all
sources:
  - https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/
  - https://aws.amazon.com/blogs/apn/building-multi-tenant-saas-applications-on-aws/
  - https://www.postgresql.org/docs/current/ddl-rowsecurity.html
---

# Multi-Tenancy Review Checklist

Use this checklist to verify your multi-tenant implementation before deployment.

---

## 🏗️ Architecture Model

### Isolation Strategy Selection
| Model | Isolation | Cost | Complexity | Use Case |
|-------|-----------|------|------------|----------|
| Shared DB, Shared Schema | Low | $ | Low | Small SaaS, cost-sensitive |
| Shared DB, Separate Schema | Medium | $$ | Medium | Medium SaaS, compliance |
| Separate Database | High | $$$ | High | Enterprise, strict compliance |
| Separate Infrastructure | Highest | $$$$ | Highest | Regulated industries |

- [ ] Isolation model documented with justification
- [ ] Model appropriate for compliance requirements
- [ ] Cost/isolation tradeoff understood
- [ ] Future scaling path defined

---

## 🔍 Tenant Resolution

### Resolution Strategy
- [ ] Single resolution method used consistently:
  - [ ] Subdomain (`tenant1.example.com`)
  - [ ] Path prefix (`/tenant1/api`)
  - [ ] Header (`X-Tenant-ID`)
  - [ ] JWT claim (`tenant_id`)
  - [ ] API key lookup

### Validation
- [ ] Tenant resolved early in request pipeline
- [ ] Tenant ID validated on every request
- [ ] Invalid tenant returns 400/404 (not 500)
- [ ] Missing tenant context fails safely
- [ ] Tenant status checked (active, suspended, deleted)

### Context
- [ ] Tenant context available via middleware
- [ ] Tenant ID not modifiable after resolution
- [ ] Request scoped (not global state)

```typescript
// Example middleware
const tenantMiddleware = (req, res, next) => {
  const tenantId = extractTenantId(req);
  if (!tenantId || !isValidTenant(tenantId)) {
    return res.status(400).json({ error: 'Invalid tenant' });
  }
  req.tenantId = tenantId;
  asyncLocalStorage.run({ tenantId }, next);
};
```

---

## 💾 Data Isolation

### Schema Design (Shared Database)
- [ ] All tenant tables have `tenant_id` column
- [ ] `tenant_id` is NOT NULL, no default
- [ ] `tenant_id` first in composite indexes
- [ ] Composite unique constraints include `tenant_id`
- [ ] Foreign keys within same tenant (composite FK if needed)

```sql
-- Example: Composite unique constraint
CREATE UNIQUE INDEX idx_orders_number_tenant 
  ON orders (tenant_id, order_number);
```

### Row Level Security (PostgreSQL)
- [ ] RLS enabled on all tenant tables
- [ ] Policies enforce tenant_id = current_setting('app.tenant_id')
- [ ] RLS tested with multiple tenants
- [ ] Superuser bypass understood and documented

```sql
-- RLS example
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Force RLS for table owner too
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
```

### Query Safety
- [ ] ORM middleware enforces tenant scope automatically
- [ ] JOINs include tenant_id conditions
- [ ] Raw SQL queries filtered by tenant
- [ ] Subqueries include tenant filter
- [ ] Aggregate queries scoped to tenant

### Data Separation Verification
- [ ] Query analyzer confirms tenant filter on all queries
- [ ] No queries bypass tenant filter
- [ ] Bulk operations include tenant_id
- [ ] Exports/reports scoped to tenant

---

## 🔄 Context Propagation

### Request Context
- [ ] AsyncLocalStorage (Node.js) or ThreadLocal (Java) configured
- [ ] Tenant context in all log entries
- [ ] Tenant context in error tracking (Sentry, etc.)
- [ ] Metrics include tenant dimension

### Async Operations
- [ ] Background jobs preserve tenant context
- [ ] Job payload includes tenant_id
- [ ] Worker validates tenant before processing
- [ ] Cron jobs iterate tenants explicitly

```typescript
// Background job example
interface TenantJob {
  tenantId: string;
  payload: any;
}

const processJob = async (job: TenantJob) => {
  await withTenantContext(job.tenantId, async () => {
    // All DB operations automatically scoped
  });
};
```

### External Integrations
- [ ] Webhooks validate tenant ownership
- [ ] OAuth state includes tenant_id
- [ ] Callbacks verify tenant context
- [ ] API responses don't leak cross-tenant data

---

## 🛡️ Authorization

### RBAC Model
- [ ] Roles defined per tenant (not global)
- [ ] Permissions assigned to roles
- [ ] User-role assignment scoped to tenant
- [ ] Same user can have different roles in different tenants

```sql
-- Per-tenant roles
CREATE TABLE tenant_roles (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(100) NOT NULL,
  permissions JSONB NOT NULL,
  UNIQUE (tenant_id, name)
);

CREATE TABLE user_tenant_roles (
  user_id UUID NOT NULL REFERENCES users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  role_id UUID NOT NULL REFERENCES tenant_roles(id),
  PRIMARY KEY (user_id, tenant_id)
);
```

### Access Control
- [ ] Permission checks on all protected routes
- [ ] Resource-level authorization (not just role)
- [ ] Implicit deny (require explicit permission)
- [ ] Admin users can't access other tenants
- [ ] Super admin access audited

### Feature Flags & Plans
- [ ] Features enabled per plan/tenant
- [ ] Feature checks enforced in backend (not just UI)
- [ ] Graceful degradation for disabled features
- [ ] Usage limits per plan enforced

---

## 🔐 Security

### Isolation Validation
- [ ] Penetration test for cross-tenant access
- [ ] Automated tests for IDOR vulnerabilities
- [ ] No tenant ID in URLs (prevents enumeration)
- [ ] UUID for tenant IDs (not sequential)

### Rate Limiting
- [ ] Rate limits per tenant (not just per IP)
- [ ] Tenant-level API quotas
- [ ] Noisy neighbor protection
- [ ] Fair share scheduling

### API Security
- [ ] API keys scoped to tenant
- [ ] JWT includes tenant claim
- [ ] Token validation includes tenant
- [ ] Cross-tenant API access denied

### Audit & Compliance
- [ ] Audit log for sensitive operations
- [ ] Audit includes tenant context
- [ ] Cross-tenant access attempts logged and alerted
- [ ] Data export per tenant (GDPR compliance)
- [ ] Data deletion per tenant capability

---

## 💳 Billing & Subscriptions

### Stripe/Payment Integration
- [ ] Stripe customer ID linked to tenant
- [ ] Webhook signature verified
- [ ] Webhook events processed idempotently
- [ ] Event handler checks tenant_id match

```typescript
// Webhook idempotency
const processStripeEvent = async (event: Stripe.Event) => {
  const processed = await db.stripeEvents.findUnique({ 
    where: { id: event.id } 
  });
  if (processed) return; // Already handled
  
  await db.$transaction(async (tx) => {
    await tx.stripeEvents.create({ data: { id: event.id } });
    await handleEvent(event, tx);
  });
};
```

### Subscription Management
- [ ] Subscription state synced to DB
- [ ] Grace period for failed payments
- [ ] Downgrade handling (data retention)
- [ ] Cancellation workflow
- [ ] Plan limits enforced in app

### Usage Tracking
- [ ] Metered usage tracked per tenant
- [ ] Usage reported to billing system
- [ ] Overage handling defined
- [ ] Usage visible to tenant admins

---

## 🧪 Testing

### Unit Tests
- [ ] Tests mock tenant context
- [ ] Service methods tested with tenant isolation
- [ ] Edge cases: no tenant, invalid tenant

### Integration Tests
- [ ] Tests use multiple tenants
- [ ] Cross-tenant access tests exist (and fail)
- [ ] RLS bypass attempts fail
- [ ] Concurrent tenant operations tested

```typescript
// Cross-tenant test example
test('tenant A cannot access tenant B data', async () => {
  const tenantA = await createTenant();
  const tenantB = await createTenant();
  const order = await createOrder(tenantB.id);
  
  setTenantContext(tenantA.id);
  const result = await orderService.findById(order.id);
  
  expect(result).toBeNull(); // Or throw NotFoundError
});
```

### Security Tests
- [ ] Automated IDOR tests
- [ ] SQL injection tests with tenant bypass attempts
- [ ] Rate limit tests per tenant
- [ ] API key scope tests

---

## 📊 Monitoring & Observability

### Metrics
- [ ] Metrics include tenant dimension
- [ ] Per-tenant latency tracking
- [ ] Per-tenant error rates
- [ ] Per-tenant resource usage

### Alerting
- [ ] Alerts for cross-tenant access attempts
- [ ] Alerts for tenant-specific errors
- [ ] Noisy neighbor detection
- [ ] Quota breach alerts

### Dashboards
- [ ] Dashboard for tenant health
- [ ] Usage tracking per tenant
- [ ] Tenant-specific debugging capability
- [ ] SLA monitoring per tenant (if applicable)

### Logging
- [ ] Tenant ID in all log entries
- [ ] Tenant-filtered log queries
- [ ] Audit log searchable by tenant
- [ ] Log retention per compliance

---

## 🚀 Operations

### Tenant Lifecycle
- [ ] Tenant provisioning automated
- [ ] Tenant suspension (no data loss)
- [ ] Tenant reactivation
- [ ] Tenant deletion (GDPR right to erasure)
- [ ] Tenant data export

### Maintenance
- [ ] Migrations tested across tenants
- [ ] Per-tenant maintenance possible
- [ ] Tenant-specific feature toggles
- [ ] Canary deployments per tenant

---

## ✅ Review Summary

| Category | Status | Notes |
|----------|--------|-------|
| Architecture | [ ] | |
| Tenant Resolution | [ ] | |
| Data Isolation | [ ] | |
| Context Propagation | [ ] | |
| Authorization | [ ] | |
| Security | [ ] | |
| Billing | [ ] | |
| Testing | [ ] | |
| Monitoring | [ ] | |

---

## Sign-Off

| Role | Name | Date |
|------|------|------|
| Security Review | | |
| Architecture Review | | |
| Development Lead | | |

---

## Sources

- [Microsoft Azure Multi-Tenant Guide](https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/)
- [AWS Multi-Tenant SaaS](https://aws.amazon.com/blogs/apn/building-multi-tenant-saas-applications-on-aws/)
- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [SaaS Tenant Isolation Strategies](https://d1.awsstatic.com/whitepapers/saas-tenant-isolation-strategies.pdf)
- [Stripe Multi-Tenant Best Practices](https://stripe.com/docs/connect/best-practices)
