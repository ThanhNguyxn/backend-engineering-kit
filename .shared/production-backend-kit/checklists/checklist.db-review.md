---
id: checklist-db-review
title: Database Review Checklist
description: Production-grade database schema, query, and migration review checklist
category: checklists
tags:
  - database
  - schema
  - performance
  - review
  - postgres
  - mysql
version: 2.0.0
scope: database
level: intermediate
maturity: stable
stacks:
  - all
sources:
  - https://www.postgresql.org/docs/current/performance-tips.html
  - https://use-the-index-luke.com/
  - https://dataintensive.net/
  - https://dev.mysql.com/doc/refman/8.0/en/optimization.html
---

# Database Review Checklist

Use this checklist when reviewing database changes before deployment.

---

## 🗂️ Schema Design

### Primary Keys
- [ ] Every table has a primary key
- [ ] PK type appropriate for scale
  - UUID: Distributed, security (no enumeration)
  - BIGINT: Performance, sequential
  - ULID: Sortable + distributed
- [ ] PK not used as business identifier (separate column)

### Foreign Keys & Relationships
- [ ] Foreign keys defined with constraints
- [ ] ON DELETE action appropriate:
  - CASCADE: Child deleted with parent
  - SET NULL: Child orphaned (nullable FK)
  - RESTRICT: Prevent parent deletion
  - NO ACTION: Check deferred to transaction end
- [ ] Circular references avoided or documented
- [ ] Junction tables for many-to-many

### Column Design
- [ ] NOT NULL on required columns
- [ ] Appropriate default values
- [ ] Column types match expected data:
  - Avoid `TEXT` for bounded strings
  - Use `DECIMAL` for money (never `FLOAT`)
  - Use `TIMESTAMPTZ` for time (with timezone)
  - Use `JSONB` not `JSON` (PostgreSQL)
- [ ] Character set UTF-8 (utf8mb4 for MySQL)

### Constraints
- [ ] Unique constraints on business keys
- [ ] Check constraints for enums/ranges
- [ ] Exclusion constraints for ranges (PostgreSQL)
- [ ] Constraint names meaningful (for error messages)

```sql
-- Good constraint naming
CONSTRAINT orders_status_check 
  CHECK (status IN ('pending', 'processing', 'completed', 'cancelled'))
```

### Standard Columns
Consider these for all tables:
- [ ] `id` - Primary key
- [ ] `created_at` - TIMESTAMPTZ DEFAULT NOW()
- [ ] `updated_at` - TIMESTAMPTZ (trigger-maintained)
- [ ] `version` - For optimistic locking (if needed)
- [ ] `deleted_at` - For soft delete (if needed)

---

## 📊 Indexing Strategy

### Index Essentials
- [ ] Foreign key columns indexed (prevents full scans on DELETE)
- [ ] Columns in WHERE clauses indexed
- [ ] Columns in ORDER BY indexed
- [ ] Columns in JOIN conditions indexed

### Composite Indexes
- [ ] Column order matches query patterns
- [ ] Most selective column first (usually)
- [ ] Equality columns before range columns
- [ ] Covering indexes for read-heavy queries

```sql
-- Query: WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC
CREATE INDEX idx_orders_tenant_status_created 
  ON orders (tenant_id, status, created_at DESC);
```

### Index Anti-Patterns
- [ ] No duplicate indexes
- [ ] No unused indexes (check `pg_stat_user_indexes`)
- [ ] No indexes on low-cardinality columns (unless composite)
- [ ] No over-indexing (hurts write performance)

### Index Types (PostgreSQL)
- [ ] B-Tree: Default, equality and range
- [ ] Hash: Equality only (rarely better than B-Tree)
- [ ] GIN: Arrays, JSONB, full-text
- [ ] GiST: Geometric, range types
- [ ] BRIN: Very large, naturally ordered tables

### Query Analysis
- [ ] EXPLAIN ANALYZE run on critical queries
- [ ] No sequential scans on large tables
- [ ] Index-only scans where possible
- [ ] Join strategies appropriate (nested loop, hash, merge)

---

## 🔄 Migration Safety

### Non-Destructive Changes
- [ ] Prefer ADD over DROP (add columns, don't remove)
- [ ] ADD column with DEFAULT is safe in PG 11+
- [ ] Rename via new column + deprecation period
- [ ] Drop columns only after code updated

### Safe Migration Patterns
| Change | Safe Approach |
|--------|---------------|
| Add column | ADD with NULL or DEFAULT |
| Add NOT NULL | ADD NULL → backfill → ADD NOT NULL |
| Rename column | Add new → migrate → drop old |
| Change type | Add new → migrate → drop old |
| Add index | CREATE INDEX CONCURRENTLY |
| Add FK | ADD CONSTRAINT NOT VALID → VALIDATE |

### Migration Checklist
- [ ] Both UP and DOWN scripts exist
- [ ] Tested on production-like data volume
- [ ] Large data updates batched
- [ ] Lock timeout set for migration
- [ ] Indexes created CONCURRENTLY

```sql
-- Safe index creation (PostgreSQL)
SET lock_timeout = '10s';
CREATE INDEX CONCURRENTLY idx_users_email ON users (email);

-- Safe NOT NULL addition
ALTER TABLE users ALTER COLUMN name SET NOT NULL;
-- Only safe if column has no NULLs!
```

### Rollback Plan
- [ ] Rollback tested
- [ ] Backward-compatible changes (new code + old schema works)
- [ ] Data loss prevention verified

---

## ⚡ Query Performance

### Query Basics
- [ ] No SELECT * (explicit columns)
- [ ] LIMIT on unbounded queries
- [ ] Appropriate JOIN type (INNER vs LEFT vs EXISTS)
- [ ] Subqueries vs JOINs evaluated

### N+1 Prevention
- [ ] Eager loading for related data
- [ ] Batch loading (DataLoader pattern)
- [ ] No queries in loops

```sql
-- Bad: N+1
SELECT * FROM users;
-- Then for each user:
SELECT * FROM orders WHERE user_id = ?;

-- Good: Single query with JOIN or IN
SELECT * FROM orders WHERE user_id IN (1, 2, 3, ...);
```

### Pagination
- [ ] OFFSET pagination only for small datasets
- [ ] Keyset pagination for large datasets
- [ ] Total count separate or estimated

```sql
-- Keyset pagination (fast)
SELECT * FROM orders 
WHERE (created_at, id) < ($last_created_at, $last_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

### Query Timeouts
- [ ] Statement timeout configured
- [ ] Lock timeout configured
- [ ] Application-level timeout shorter than DB timeout

```sql
-- PostgreSQL session settings
SET statement_timeout = '30s';
SET lock_timeout = '10s';
```

---

## 🔗 Connection Management

### Connection Pooling
- [ ] Connection pooler used (PgBouncer, RDS Proxy)
- [ ] Pool size calculated:
  ```
  connections = ((core_count * 2) + effective_spindle_count)
  ```
- [ ] Max connections respected
- [ ] Connection leaks prevented (always close/return)

### Pool Configuration
| Setting | Typical Value |
|---------|---------------|
| Min connections | 5-10 |
| Max connections | 20-50 |
| Connection timeout | 10s |
| Idle timeout | 300s |
| Max lifetime | 1800s |

---

## 🔐 Data Integrity

### Transactions
- [ ] Multi-step operations wrapped in transaction
- [ ] Transaction isolation level appropriate:
  - Read Committed: Default, good for most
  - Repeatable Read: Consistent reads in transaction
  - Serializable: Full isolation (slow)
- [ ] Transactions short (no user interaction inside)
- [ ] Deadlock handling (retry logic)

### Concurrency Control
- [ ] Optimistic locking with version column
- [ ] SELECT FOR UPDATE for pessimistic locking
- [ ] Advisory locks for distributed operations

```sql
-- Optimistic locking
UPDATE orders 
SET status = 'shipped', version = version + 1
WHERE id = $1 AND version = $2;
-- Check affected rows = 1
```

### Audit Trail
- [ ] Sensitive data changes logged
- [ ] Audit log includes: who, what, when, old/new values
- [ ] Audit tables append-only
- [ ] Consider CDC (Change Data Capture) for scale

### Soft Delete
- [ ] `deleted_at` column if data recoverable
- [ ] Unique constraints include deleted_at
- [ ] Default scope excludes deleted
- [ ] Hard delete after retention period

```sql
-- Unique with soft delete
CREATE UNIQUE INDEX idx_users_email_active 
  ON users (email) WHERE deleted_at IS NULL;
```

---

## 💾 Backup & Recovery

### Backup Strategy
- [ ] Automated backups configured
- [ ] Point-in-time recovery enabled (WAL archiving)
- [ ] Backup retention policy defined
- [ ] Backups tested regularly (restore drill)
- [ ] Backups encrypted

### Recovery
- [ ] RTO (Recovery Time Objective) documented
- [ ] RPO (Recovery Point Objective) documented
- [ ] Recovery procedure documented
- [ ] Replica promotion tested

---

## 📊 Monitoring

### Key Metrics
- [ ] Query latency (p50, p95, p99)
- [ ] Connection pool utilization
- [ ] Slow query logging enabled
- [ ] Lock wait monitoring
- [ ] Replication lag (if applicable)

### PostgreSQL Stats
- [ ] `pg_stat_statements` enabled
- [ ] `pg_stat_user_tables` monitored (seq scans, dead tuples)
- [ ] `pg_stat_user_indexes` monitored (unused indexes)
- [ ] VACUUM/ANALYZE running regularly

---

## ✅ Review Summary

| Category | Status | Notes |
|----------|--------|-------|
| Schema Design | [ ] | |
| Indexing | [ ] | |
| Migrations | [ ] | |
| Performance | [ ] | |
| Connections | [ ] | |
| Data Integrity | [ ] | |
| Backup | [ ] | |

---

## Sign-Off

| Role | Name | Date |
|------|------|------|
| DBA/DB Reviewer | | |
| Development Lead | | |

---

## Sources

- [PostgreSQL Performance Tips](https://www.postgresql.org/docs/current/performance-tips.html)
- [Use The Index, Luke](https://use-the-index-luke.com/)
- [Designing Data-Intensive Applications](https://dataintensive.net/)
- [PostgreSQL Wiki - Don't Do This](https://wiki.postgresql.org/wiki/Don%27t_Do_This)
- [MySQL Optimization](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)
- [PgBouncer Documentation](https://www.pgbouncer.org/)
