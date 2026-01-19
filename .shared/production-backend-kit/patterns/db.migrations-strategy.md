---
id: db-migrations-strategy
title: Database Migrations Strategy
tags:
  - database
  - migrations
  - schema
  - devops
  - zero-downtime
level: intermediate
stacks:
  - all
scope: database
maturity: stable
version: 2.0.0
sources:
  - https://martinfowler.com/articles/evodb.html
  - https://flywaydb.org/documentation/concepts/migrations
  - https://docs.djangoproject.com/en/5.0/topics/migrations/
---

# Database Migrations Strategy

## Problem

Unmanaged schema changes cause deployment failures, data loss, and environment drift. Without migration strategy, rolling back is painful and synchronizing schemas across environments is error-prone. Zero-downtime deployments require special care.

## When to use

- Any application with database
- Multi-environment deployments (dev, staging, prod)
- Team collaboration on schema
- CI/CD pipelines
- Blue-green or rolling deployments
- Zero-downtime requirements

## Solution

### 1. Migration File Structure

```
migrations/
├── V001__create_users_table.sql
├── V002__add_email_to_users.sql
├── V003__create_orders_table.sql
├── V004__add_index_orders_user_id.sql
└── V005__add_status_to_orders.sql

# Naming: V{version}__{description}.sql
# Version: Sequential number (001, 002, ...)
# Description: Snake_case, describes change
```

### 2. Safe Migration Patterns

| Change | Unsafe | Safe Approach |
|--------|--------|---------------|
| Add column | - | Add with NULL or DEFAULT |
| Add NOT NULL | Add directly | Add NULL → backfill → alter NOT NULL |
| Rename column | Rename directly | Add new → copy → drop old |
| Change type | Alter directly | Add new → migrate → drop old |
| Add index | CREATE INDEX | CREATE INDEX CONCURRENTLY |
| Add FK | ADD CONSTRAINT | ADD CONSTRAINT NOT VALID → VALIDATE |
| Drop column | Drop directly | Remove code references → drop |
| Drop table | Drop directly | Rename to _deleted → wait → drop |

### 3. Expand-Contract Pattern (Zero Downtime)

```
Phase 1: EXPAND (Backward Compatible)
──────────────────────────────────
- Add new column (nullable)
- Deploy: New code writes to BOTH old and new columns
- Backfill: Copy data from old to new column
- Old code still works (reads old column)

Phase 2: MIGRATE (Switch Over)
──────────────────────────────────
- Deploy: Code reads from NEW column only
- Old column is now unused
- Verify all data migrated correctly

Phase 3: CONTRACT (Cleanup)
──────────────────────────────────
- Drop old column
- Remove dual-write code
- Schema is clean
```

**Example: Rename Column `name` to `full_name`**

```sql
-- Migration 1: EXPAND
ALTER TABLE users ADD COLUMN full_name VARCHAR(255);
UPDATE users SET full_name = name WHERE full_name IS NULL;

-- Deploy code that writes to BOTH columns
-- Deploy code that reads from full_name with fallback to name

-- Migration 2: Add NOT NULL (after backfill verified)
ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;

-- Deploy code that reads ONLY from full_name

-- Migration 3: CONTRACT (after all code deployed)
ALTER TABLE users DROP COLUMN name;
```

### 4. Safe Index Creation (PostgreSQL)

```sql
-- UNSAFE: Locks table for entire duration
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- SAFE: Non-blocking (PostgreSQL)
SET lock_timeout = '5s';
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id);

-- Note: CONCURRENTLY cannot run in transaction
-- If it fails partway, you may have an INVALID index
-- Check with: SELECT * FROM pg_indexes WHERE indexname = 'idx_orders_user_id';
-- Drop invalid: DROP INDEX CONCURRENTLY idx_orders_user_id;
```

### 5. Safe Foreign Key Addition (PostgreSQL)

```sql
-- UNSAFE: Scans entire table while holding lock
ALTER TABLE orders 
  ADD CONSTRAINT fk_orders_user_id 
  FOREIGN KEY (user_id) REFERENCES users(id);

-- SAFE: Two-step process
-- Step 1: Add constraint without validation (instant)
ALTER TABLE orders 
  ADD CONSTRAINT fk_orders_user_id 
  FOREIGN KEY (user_id) REFERENCES users(id) 
  NOT VALID;

-- Step 2: Validate separately (non-blocking in PG 12+)
ALTER TABLE orders 
  VALIDATE CONSTRAINT fk_orders_user_id;
```

### 6. Batched Data Migration

```sql
-- UNSAFE: Updates all rows, holds locks
UPDATE orders SET status = 'pending' WHERE status IS NULL;

-- SAFE: Batch updates
DO $$
DECLARE
  batch_size INT := 10000;
  rows_updated INT;
BEGIN
  LOOP
    UPDATE orders
    SET status = 'pending'
    WHERE id IN (
      SELECT id FROM orders 
      WHERE status IS NULL 
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED
    );
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    
    IF rows_updated = 0 THEN
      EXIT;
    END IF;
    
    COMMIT;
    PERFORM pg_sleep(0.1); -- Brief pause to reduce load
  END LOOP;
END $$;
```

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Missing rollback script | Always write down + up migration |
| Locking tables in prod | Use CREATE INDEX CONCURRENTLY |
| Dropping columns immediately | Expand-contract: deprecate first |
| Testing on empty DB | Test with production-like data |
| Manual schema changes | Only apply through migrations |

## Checklist

- [ ] Migration tool configured
- [ ] Migrations version-controlled
- [ ] Up and down scripts provided
- [ ] Migrations run in CI
- [ ] Non-destructive changes preferred
- [ ] Large data updates batched
- [ ] Indexes created concurrently (if supported)
- [ ] Production backup taken before major changes
- [ ] Schema drift detection in place
- [ ] Migration rollback tested

## Snippets (Generic)

```
Migration File Structure:
migrations/
├── 001_create_users_table.sql
├── 002_add_email_to_users.sql
├── 003_create_orders_table.sql
└── 004_add_user_id_index_orders.sql

Expand-Contract Pattern:
Phase 1 (Expand):
  - Add new column (nullable)
  - Backfill data
  - Update app to write to both
  
Phase 2 (Migrate):
  - Update app to read from new column
  - Verify all data migrated

Phase 3 (Contract):
  - Remove old column references
  - Drop old column

Safe Index Creation (PostgreSQL):
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id);

Steps:
1. Generate migration file (timestamped)
2. Write UP migration (apply change)
3. Write DOWN migration (rollback)
4. Test in development
5. Apply in staging
6. Backup production
7. Apply in production (during low traffic)
8. Verify and monitor
```

## Sources

- Flyway Documentation: https://documentation.red-gate.com/fd/flyway-documentation-138346877.html
- GitHub - Expand and Contract: https://github.blog/2024-02-12-how-github-evolved-its-schema-to-support-notifications-at-scale/
- Strong Migrations (Ruby): https://github.com/ankane/strong_migrations
- Liquibase Best Practices: https://docs.liquibase.com/concepts/bestpractices.html
