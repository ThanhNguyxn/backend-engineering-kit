---
id: db-schema-constraints
title: Database Schema Constraints
tags: [database, schema, constraints, integrity]
level: beginner
stacks: [postgresql, mysql, sqlserver]
---

# Database Schema Constraints

## Problem

Without proper constraints, invalid data enters the database, causing application crashes, data corruption, and expensive cleanup operations. Business rules enforced only in application code can be bypassed.

## When to use

- Every database table design
- Data integrity is critical
- Multiple applications access same database
- Preventing orphan records
- Enforcing business rules at data layer

## Solution

1. **Primary key constraints**
   - Every table needs a primary key
   - Prefer surrogate keys (UUID, auto-increment)
   - Composite keys for junction tables

2. **Foreign key constraints**
   - Define relationships explicitly
   - Choose appropriate ON DELETE action
   - Index foreign key columns

3. **Unique constraints**
   - Prevent duplicates on business keys
   - Consider partial unique indexes
   - Handle NULL behavior

4. **Check constraints**
   - Validate ranges, formats, enums
   - Enforce business rules
   - Keep simple for performance

5. **Not null constraints**
   - Default to NOT NULL
   - Only allow NULL when meaningful
   - Document NULL semantics

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| No foreign key indexes | Always index FK columns |
| CASCADE DELETE on critical data | Use RESTRICT or SET NULL |
| Over-constraining early | Start strict, relax if needed |
| Ignoring NULL in unique | Use partial index or COALESCE |
| Complex check constraints | Move complex logic to triggers/app |

## Checklist

- [ ] Every table has primary key
- [ ] Foreign keys defined for relationships
- [ ] Foreign key columns indexed
- [ ] ON DELETE behavior explicitly chosen
- [ ] Unique constraints on business keys
- [ ] NOT NULL on required fields
- [ ] Check constraints for simple validations
- [ ] Constraint names are descriptive
- [ ] Migration tests validate constraints
- [ ] Constraints documented in schema

## Snippets (Generic)

```
Table Definition:
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'paid', 'shipped')),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT orders_user_id_idx INDEX (user_id),
  CONSTRAINT orders_email_unique UNIQUE (email)
);

ON DELETE Options:
- RESTRICT: Prevent delete if children exist
- CASCADE: Delete children automatically
- SET NULL: Set FK to NULL on parent delete
- SET DEFAULT: Set FK to default value

Steps:
1. Define primary key (UUID or serial)
2. Add foreign keys with ON DELETE behavior
3. Create indexes on foreign key columns
4. Add NOT NULL to required fields
5. Add unique constraints on business keys
6. Add check constraints for enums/ranges
```

## Sources

- PostgreSQL Constraints: https://www.postgresql.org/docs/current/ddl-constraints.html
- MySQL Foreign Keys: https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html
- Use The Index, Luke: https://use-the-index-luke.com/
- Database Design Best Practices: https://vertabelo.com/blog/database-design-best-practices/
