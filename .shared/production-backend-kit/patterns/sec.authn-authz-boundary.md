---
id: sec-authn-authz-boundary
title: Authentication vs Authorization Boundary
tags:
  - security
  - authentication
  - authorization
  - rbac
  - access-control
level: intermediate
stacks:
  - all
scope: security
maturity: stable
---

# Authentication vs Authorization Boundary

## Problem

Confusing authentication (who are you?) with authorization (what can you do?) leads to security holes, inconsistent access controls, and hard-to-maintain permission systems.

## When to use

- Any application with user accounts
- Multi-tenant systems
- APIs with different access levels
- Role-based or attribute-based access
- Resource-level permissions

## Solution

1. **Separate concerns clearly**
   - Authentication: Verify identity (login, tokens)
   - Authorization: Check permissions (roles, policies)
   - Handle in separate middleware/layers

2. **Authentication layer**
   - Validate credentials (password, OAuth, SSO)
   - Issue tokens (JWT, session)
   - Attach identity to request context
   - Return 401 Unauthorized if fails

3. **Authorization layer**
   - Extract permissions from identity
   - Check against required permissions
   - Return 403 Forbidden if denied
   - Use consistent permission model

4. **Choose authorization model**
   - RBAC: Role-Based Access Control
   - ABAC: Attribute-Based Access Control
   - ReBAC: Relationship-Based Access Control

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Mixing 401 and 403 | 401 = who are you?, 403 = you can't do that |
| Checking perms in business logic | Use middleware/decorators |
| Hardcoding roles everywhere | Centralize permission checks |
| Not logging access denials | Always log for security audit |
| Over-privileged defaults | Default deny, explicit allow |

## Checklist

- [ ] Authentication and authorization are separate layers
- [ ] 401 used for authentication failures
- [ ] 403 used for authorization failures
- [ ] Identity attached to request context after auth
- [ ] Permissions checked before business logic
- [ ] Role/permission model documented
- [ ] Default-deny policy enforced
- [ ] Access denials logged with context
- [ ] Admin functions protected separately
- [ ] Permission changes audited

## Snippets (Generic)

```
Request Flow:
1. Request arrives
2. Authentication middleware:
   - Extract token from header
   - Verify token signature & expiry
   - Attach user identity to context
   - If invalid → 401 Unauthorized
3. Authorization middleware:
   - Extract required permissions for route
   - Check user roles/permissions
   - If denied → 403 Forbidden
4. Business logic executes

HTTP Status Codes:
- 401 Unauthorized: "I don't know who you are"
  - Missing token, invalid token, expired token
- 403 Forbidden: "I know who you are, but no access"
  - Valid user, insufficient permissions

RBAC Model:
User → Roles → Permissions
Example: user.roles = ['editor']
         editor.permissions = ['read', 'write']
         admin.permissions = ['read', 'write', 'delete']

Middleware Pattern:
@authenticate  # First: verify identity
@authorize('write')  # Second: check permission
def update_article(id):
  # Business logic here
```

## Sources

- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- NIST RBAC Model: https://csrc.nist.gov/projects/role-based-access-control
- Google Zanzibar Paper: https://research.google/pubs/pub48190/
