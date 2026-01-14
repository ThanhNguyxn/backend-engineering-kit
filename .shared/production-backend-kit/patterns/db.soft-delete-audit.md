---
id: db-soft-delete-audit
title: Soft Delete & Audit Trail
tags: [database, soft-delete, auditing, compliance]
level: intermediate
stacks: [all]
---

# Soft Delete & Audit Trail

## Problem

Hard deletes permanently lose data, making debugging, compliance, and recovery impossible. Without audit trails, you can't answer "who changed what and when."

## When to use

- Regulatory compliance (GDPR, SOX, HIPAA)
- Data recovery requirements
- Undo/restore functionality
- Historical analysis and reporting
- Debugging production issues
- Multi-tenant applications

## Solution

1. **Implement soft delete**
   - Add `deleted_at` timestamp column
   - Filter out soft-deleted in default queries
   - Keep foreign key integrity
   - Consider global query scope/filter

2. **Create audit trail**
   - Track who, what, when for changes
   - Store old and new values
   - Use triggers or application middleware
   - Consider event sourcing for critical domains

3. **Handle related data**
   - Cascade soft-delete to children
   - Consider restore implications
   - Archive old soft-deleted data

4. **Set retention policy**
   - Define how long to keep deleted data
   - Automate hard-delete after retention period
   - Consider compliance requirements

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Forgetting filter in queries | Use global scope/default clause |
| Unique constraint conflicts | Include deleted_at in unique indexes |
| Performance degradation | Partition or archive old records |
| Missing FK in soft-delete | Soft-delete must cascade appropriately |
| Audit table bloat | Archive or partition audit logs |

## Checklist

- [ ] deleted_at column added to relevant tables
- [ ] Default query scope filters deleted records
- [ ] Unique indexes include deleted_at
- [ ] Audit table captures who/what/when
- [ ] Old and new values stored in audit
- [ ] Foreign key implications handled
- [ ] Restore functionality tested
- [ ] Retention policy defined
- [ ] Archive strategy for old data
- [ ] GDPR right-to-erasure considered

## Snippets (Generic)

```
Soft Delete Schema:
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL  -- NULL = not deleted
);

-- Unique that allows "deleted" duplicates
CREATE UNIQUE INDEX idx_users_email_active 
  ON users(email) WHERE deleted_at IS NULL;

Audit Table Schema:
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(10) NOT NULL,  -- INSERT, UPDATE, DELETE
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

Soft Delete Query:
-- Default: only active records
SELECT * FROM users WHERE deleted_at IS NULL;

-- Include deleted (admin view)
SELECT * FROM users;

-- Only deleted (recovery view)
SELECT * FROM users WHERE deleted_at IS NOT NULL;

Steps:
1. Add deleted_at column (nullable timestamp)
2. Update unique constraints to be partial
3. Add default scope to filter deleted
4. Create audit_log table
5. Implement trigger or middleware for auditing
6. Define retention and archive strategy
```

## Sources

- Soft Delete Patterns: https://brandur.org/soft-deletion
- PostgreSQL Audit Trigger: https://wiki.postgresql.org/wiki/Audit_trigger
- Django Simple History: https://django-simple-history.readthedocs.io/
- Database Audit Logging (OWASP): https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
