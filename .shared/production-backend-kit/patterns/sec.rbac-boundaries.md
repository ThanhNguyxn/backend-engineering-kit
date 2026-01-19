---
id: sec.rbac-boundaries
title: RBAC & Authorization Boundaries
tags: [security, rbac, authorization, permissions]
scope: security
level: intermediate
maturity: stable
stacks: [nodejs, python, go, all]
description: Role-based access control for multi-tenant SaaS
version: 2.0.0
sources:
  - https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
  - https://csrc.nist.gov/projects/role-based-access-control
  - https://research.google/pubs/pub48190/
---

# RBAC & Authorization Boundaries

## Problem

Multi-tenant SaaS needs fine-grained access control: users have roles within their tenant, and permissions must be checked on every operation.

## When to use

- SaaS with multiple users per tenant
- Different permission levels (admin, member, viewer)
- Need to control feature access by plan
- Audit requirements for access decisions

## Solution

### 1. Role & Permission Model

```typescript
// Roles are tenant-scoped
interface Role {
  id: string;
  tenantId: string;
  name: string;
  permissions: Permission[];
  isSystem: boolean; // Built-in vs custom
}

// Permissions are global definitions
type Permission = 
  | 'users:read' | 'users:write' | 'users:delete'
  | 'orders:read' | 'orders:write' | 'orders:delete'
  | 'billing:read' | 'billing:write'
  | 'settings:read' | 'settings:write'
  | 'admin:*';

// Default roles
const DEFAULT_ROLES: Record<string, Permission[]> = {
  owner: ['admin:*'],
  admin: ['users:*', 'orders:*', 'settings:*', 'billing:read'],
  member: ['orders:read', 'orders:write'],
  viewer: ['orders:read'],
};
```

### 2. Permission Check Middleware

```typescript
function requirePermission(...required: Permission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const tenant = req.tenant;
    
    // Get user's roles in this tenant
    const userRoles = await roleService.getUserRoles(user.id, tenant.id);
    const userPermissions = new Set<string>();
    
    for (const role of userRoles) {
      for (const perm of role.permissions) {
        userPermissions.add(perm);
        // Handle wildcards
        if (perm.endsWith(':*')) {
          const resource = perm.replace(':*', '');
          ['read', 'write', 'delete'].forEach(action => 
            userPermissions.add(`${resource}:${action}`)
          );
        }
        // admin:* grants everything
        if (perm === 'admin:*') {
          return next();
        }
      }
    }
    
    // Check all required permissions
    const hasAll = required.every(p => userPermissions.has(p));
    if (!hasAll) {
      logger.warn({
        event: 'PERMISSION_DENIED',
        userId: user.id,
        tenantId: tenant.id,
        required,
        had: [...userPermissions],
      });
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' }
      });
    }
    
    next();
  };
}

// Usage
app.get('/api/users', 
  requirePermission('users:read'),
  userController.list
);

app.delete('/api/users/:id',
  requirePermission('users:delete'),
  userController.remove
);
```

### 3. Resource-Level Authorization

```typescript
// Not just "can user do X?" but "can user do X to THIS resource?"
async function canAccessResource(
  userId: string,
  tenantId: string,
  resourceType: string,
  resourceId: string,
  action: 'read' | 'write' | 'delete'
): Promise<boolean> {
  // 1. Check tenant ownership
  const resource = await getResource(resourceType, resourceId);
  if (resource.tenant_id !== tenantId) {
    return false; // Cross-tenant access denied
  }
  
  // 2. Check user permissions
  const hasPermission = await hasUserPermission(
    userId, 
    tenantId, 
    `${resourceType}:${action}`
  );
  if (!hasPermission) {
    return false;
  }
  
  // 3. Check resource-specific rules
  if (resourceType === 'order' && action === 'write') {
    // Only owner or assigned user can edit
    if (resource.created_by !== userId && resource.assigned_to !== userId) {
      const isAdmin = await hasUserPermission(userId, tenantId, 'admin:*');
      if (!isAdmin) return false;
    }
  }
  
  return true;
}
```

### 4. Feature Flags by Plan

```typescript
interface TenantPlan {
  name: 'free' | 'pro' | 'enterprise';
  features: string[];
  limits: Record<string, number>;
}

const PLANS: Record<string, TenantPlan> = {
  free: {
    name: 'free',
    features: ['basic_reports'],
    limits: { users: 3, projects: 5 }
  },
  pro: {
    name: 'pro', 
    features: ['basic_reports', 'advanced_reports', 'api_access'],
    limits: { users: 25, projects: 50 }
  },
  enterprise: {
    name: 'enterprise',
    features: ['*'],
    limits: { users: -1, projects: -1 } // Unlimited
  }
};

function requireFeature(feature: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tenant = req.tenant;
    const plan = PLANS[tenant.plan];
    
    if (!plan.features.includes(feature) && !plan.features.includes('*')) {
      return res.status(403).json({
        error: { 
          code: 'FEATURE_NOT_AVAILABLE',
          message: `Upgrade to access ${feature}`,
          upgradeUrl: `/billing/upgrade`
        }
      });
    }
    next();
  };
}
```

## Pitfalls

1. **Checking role instead of permission**: Roles change, permissions are stable
2. **Client-only checks**: Always verify on server
3. **Forgot tenant scope**: User in Tenant A shouldn't see Tenant B roles
4. **Permission creep**: Regular audits of who has what

## Checklist

- [ ] Permission model defined (not just roles)
- [ ] Middleware checks on all protected routes
- [ ] Resource-level authorization implemented
- [ ] Feature flags by plan working
- [ ] Audit log for permission denials
- [ ] Regular permission review process
