---
id: sec.multitenancy-basics
title: Multi-Tenancy Basics
tags: [security, multitenancy, saas, tenant]
scope: security
level: intermediate
maturity: stable
stacks: [nodejs, python, go, all]
description: Tenant resolution strategies for SaaS applications
version: 2.0.0
sources:
  - https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations
  - https://aws.amazon.com/blogs/apn/multi-tenant-saas-database-isolation-strategies/
  - https://supabase.com/docs/guides/auth/row-level-security
---

# Multi-Tenancy Basics

## Problem

SaaS applications need to serve multiple tenants (customers) from a single codebase while ensuring complete data isolation and proper tenant identification.

## When to use

- Building SaaS products with multiple customers
- Need to isolate data between organizations
- Want shared infrastructure with logical separation
- Starting with a monolith but need multi-tenant from day 1

## Solution

### 1. Tenant Resolution Strategies

Choose one or combine multiple strategies:

```typescript
// Strategy 1: Subdomain-based
// customer1.yourapp.com → tenant_id = "customer1"
function resolveFromSubdomain(host: string): string | null {
  const parts = host.split('.');
  if (parts.length >= 3) {
    return parts[0]; // First subdomain is tenant
  }
  return null;
}

// Strategy 2: Header-based
// X-Tenant-ID: customer1
function resolveFromHeader(req: Request): string | null {
  return req.headers['x-tenant-id'] as string || null;
}

// Strategy 3: JWT claim
// { sub: "user123", tenant_id: "customer1" }
function resolveFromJWT(token: DecodedToken): string | null {
  return token.tenant_id || token.org_id || null;
}

// Strategy 4: Path-based (less common)
// /api/v1/tenants/customer1/resources
function resolveFromPath(path: string): string | null {
  const match = path.match(/^\/api\/v\d+\/tenants\/([^\/]+)/);
  return match ? match[1] : null;
}
```

### 2. Tenant Context Middleware

```typescript
interface TenantContext {
  tenantId: string;
  tenantName: string;
  plan: 'free' | 'pro' | 'enterprise';
  features: string[];
}

// Express middleware
async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 1. Resolve tenant ID
  const tenantId = resolveFromJWT(req.user) 
    || resolveFromHeader(req)
    || resolveFromSubdomain(req.hostname);

  if (!tenantId) {
    return res.status(400).json({
      error: { code: 'TENANT_REQUIRED', message: 'Tenant identification required' }
    });
  }

  // 2. Load tenant config
  const tenant = await tenantService.getById(tenantId);
  if (!tenant) {
    return res.status(404).json({
      error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' }
    });
  }

  // 3. Attach to request
  req.tenant = tenant;
  
  // 4. Set for async context (logging, DB queries)
  asyncLocalStorage.run({ tenantId }, () => next());
}
```

### 3. Database Approach Decision

| Approach | Pros | Cons | Best For |
|----------|------|------|----------|
| **Shared DB + tenant_id column** | Simple, low cost | Query discipline needed | Startups, < 1000 tenants |
| **Shared DB + schema per tenant** | Better isolation | Schema migrations harder | Medium scale |
| **Database per tenant** | Full isolation | Ops complexity | Enterprise/compliance |

**Recommendation for lite SaaS**: Start with shared DB + `tenant_id` column.

## Pitfalls

1. **Forgetting tenant filter**: Every query MUST include tenant_id
2. **Cross-tenant data leaks**: Test with multiple tenant users
3. **Tenant in URL but not validated**: Always verify against authenticated user
4. **Missing tenant in async operations**: Jobs, webhooks need tenant context

## Checklist

- [ ] Tenant resolution strategy chosen and documented
- [ ] Middleware validates tenant on every request
- [ ] Tenant context available in logs
- [ ] Database queries scoped to tenant
- [ ] Background jobs preserve tenant context
- [ ] Webhooks validate tenant ownership
