---
id: sec.data-isolation
title: Data Isolation Strategies
tags: [security, multitenancy, database, rls]
scope: security
level: advanced
maturity: stable
stacks: [nodejs, python, go, all]
description: Row-level security and data isolation for multi-tenant databases
---

# Data Isolation Strategies

## Problem

In shared-database multi-tenancy, preventing data leaks between tenants is critical. A single missing WHERE clause can expose customer data.

## When to use

- Shared database with tenant_id column approach
- Need defense-in-depth for data isolation
- Want ORM-level or database-level enforcement
- Compliance requirements for data separation

## Solution

### 1. Application-Level: ORM Middleware

```typescript
// Prisma middleware example
prisma.$use(async (params, next) => {
  const tenantId = getTenantId();
  
  // Tables that require tenant scoping
  const tenantTables = ['User', 'Order', 'Invoice', 'Project'];
  
  if (tenantTables.includes(params.model!)) {
    // Inject tenant_id into all queries
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args.where = { ...params.args.where, tenant_id: tenantId };
    }
    if (params.action === 'create') {
      params.args.data.tenant_id = tenantId;
    }
    if (params.action === 'update' || params.action === 'delete') {
      params.args.where = { ...params.args.where, tenant_id: tenantId };
    }
  }
  
  return next(params);
});
```

### 2. Database-Level: Row-Level Security (PostgreSQL)

```sql
-- Enable RLS on table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Set tenant context before queries
SET app.current_tenant = 'tenant-uuid-here';

-- Now all queries are automatically filtered
SELECT * FROM orders; -- Only returns rows for current tenant
```

### 3. Connection-Level Tenant Setting

```typescript
// Set tenant on each request
async function executeWithTenant<T>(
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  // Set PostgreSQL session variable
  await db.query(`SET app.current_tenant = $1`, [tenantId]);
  
  try {
    return await fn();
  } finally {
    // Reset for connection pool safety
    await db.query(`RESET app.current_tenant`);
  }
}

// Usage in middleware
app.use(async (req, res, next) => {
  await executeWithTenant(req.tenant.id, () => {
    return next();
  });
});
```

### 4. Foreign Key Constraints

```sql
-- Ensure referential integrity includes tenant
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL,
  -- Composite foreign key ensures user belongs to same tenant
  FOREIGN KEY (tenant_id, user_id) 
    REFERENCES users(tenant_id, id)
);

-- Composite index for performance
CREATE INDEX idx_orders_tenant_user ON orders(tenant_id, user_id);
```

### 5. Audit Trail

```typescript
// Log all cross-tenant access attempts
function logAccessAttempt(
  action: string,
  requestedTenantId: string,
  actualTenantId: string
) {
  if (requestedTenantId !== actualTenantId) {
    logger.warn({
      event: 'CROSS_TENANT_ACCESS_ATTEMPT',
      action,
      requestedTenantId,
      actualTenantId,
      userId: getContext()?.userId,
    });
    
    // Alert security team for repeated attempts
    alertService.checkAndNotify('cross-tenant-access', actualTenantId);
  }
}
```

## Migration Strategy

For existing single-tenant apps moving to multi-tenant:

```sql
-- 1. Add tenant_id column
ALTER TABLE users ADD COLUMN tenant_id UUID;

-- 2. Backfill with default tenant
UPDATE users SET tenant_id = 'default-tenant-uuid' WHERE tenant_id IS NULL;

-- 3. Make NOT NULL
ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;

-- 4. Add index
CREATE INDEX idx_users_tenant ON users(tenant_id);

-- 5. Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

## Pitfalls

1. **RLS bypassed by superusers**: Use non-superuser roles for app
2. **Missing indexes**: Every table with tenant_id needs index
3. **JOIN without tenant filter**: Cross-table queries can leak
4. **Connection pool contamination**: Reset tenant settings

## Checklist

- [ ] Every tenant-scoped table has tenant_id column
- [ ] All tenant_id columns have indexes
- [ ] ORM middleware or RLS policies in place
- [ ] Composite foreign keys where applicable
- [ ] Audit logging for access attempts
- [ ] Tests verify cross-tenant queries fail
