---
id: db-indexing-basics
title: Database Indexing Basics
tags:
  - database
  - indexing
  - performance
  - query-optimization
  - explain
level: intermediate
stacks:
  - postgresql
  - mysql
  - sqlserver
  - mongodb
scope: database
maturity: stable
version: 2.0.0
sources:
  - https://use-the-index-luke.com/
  - https://www.postgresql.org/docs/current/indexes.html
  - https://dev.mysql.com/doc/refman/8.0/en/optimization-indexes.html
---

# Database Indexing Basics

## Problem

Queries on large tables without proper indexes result in full table scans, causing slow response times, high CPU usage, and poor user experience. Over-indexing wastes disk space and slows writes. The key is finding the right balance.

## When to use

- Columns used in WHERE clauses (especially with high selectivity)
- Columns used in JOIN conditions
- Columns used in ORDER BY / GROUP BY
- Foreign key columns (prevents full scans on DELETE)
- Columns with unique constraints
- Frequently searched text (full-text indexes)

## Solution

### 1. Understand Index Types

| Type | Use Case | PostgreSQL | MySQL |
|------|----------|------------|-------|
| **B-Tree** | Default, equality, range, sorting | ✓ Default | ✓ Default |
| **Hash** | Equality only (rarely better) | ✓ | ✓ (InnoDB internal) |
| **GIN** | Arrays, JSONB, full-text | ✓ | - |
| **GiST** | Geometric, range types | ✓ | - |
| **BRIN** | Very large, naturally ordered tables | ✓ | - |
| **Full-Text** | Text search | tsvector + GIN | FULLTEXT |

### 2. Composite Index Column Order

**Rule**: Equality columns first, then range columns, then sort columns.

```sql
-- Query:
SELECT * FROM orders 
WHERE tenant_id = $1      -- Equality
  AND status = $2         -- Equality  
  AND created_at > $3     -- Range
ORDER BY created_at DESC;

-- Optimal index:
CREATE INDEX idx_orders_tenant_status_created 
  ON orders (tenant_id, status, created_at DESC);
```

### 3. Covering Indexes (Index-Only Scans)

Include all columns needed by query to avoid table lookup:

```sql
-- Query only needs these columns
SELECT id, status, total FROM orders WHERE user_id = $1;

-- Covering index
CREATE INDEX idx_orders_user_covering 
  ON orders (user_id) INCLUDE (id, status, total);
```

### 4. Partial Indexes (PostgreSQL)

Index only rows matching a condition:

```sql
-- Only 5% of orders are 'pending', but queried frequently
CREATE INDEX idx_orders_pending 
  ON orders (created_at) WHERE status = 'pending';
```

### 5. Index Maintenance

```sql
-- PostgreSQL: Check unused indexes
SELECT indexrelname, idx_scan, idx_tup_read 
FROM pg_stat_user_indexes 
WHERE idx_scan = 0;

-- PostgreSQL: Check index bloat
SELECT * FROM pgstattuple('idx_orders_user_id');

-- Reindex (careful in production)
REINDEX INDEX CONCURRENTLY idx_orders_user_id;
```

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Indexing every column | Only index queried columns |
| Wrong column order in composite | Put highest selectivity first |
| Ignoring index on FKs | Always index foreign keys |
| Not using EXPLAIN | Always verify index usage |
| Indexes on low-cardinality columns | Boolean/status rarely benefit |

## Checklist

- [ ] Foreign key columns indexed
- [ ] Frequently queried columns indexed
- [ ] Composite index column order optimized
- [ ] EXPLAIN used to verify index usage
- [ ] Unused indexes identified and removed
- [ ] Partial indexes used where applicable
- [ ] Index on columns in WHERE/JOIN/ORDER BY
- [ ] Write performance impact considered
- [ ] Index statistics up to date
- [ ] Index naming convention followed

## Snippets (Generic)

```
EXPLAIN ANALYZE:
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
-- Look for: "Index Scan" vs "Seq Scan"

Creating Indexes:
-- Single column
CREATE INDEX idx_users_email ON users(email);

-- Composite (order matters!)
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

-- Partial index
CREATE INDEX idx_orders_pending ON orders(created_at) 
  WHERE status = 'pending';

-- Covering index (includes all needed columns)
CREATE INDEX idx_orders_covering ON orders(user_id, status) 
  INCLUDE (total, created_at);

Index Selection Rules:
1. Column in WHERE → Consider index
2. Column in JOIN ON → Index required
3. Column in ORDER BY → May benefit from index
4. Low cardinality (boolean) → Usually skip
5. High write table → Be conservative

Steps:
1. Enable slow query logging
2. Identify top slow queries
3. Run EXPLAIN ANALYZE on them
4. Add targeted indexes
5. Verify with EXPLAIN again
6. Monitor index usage over time
```

## Sources

- Use The Index, Luke: https://use-the-index-luke.com/
- PostgreSQL Indexes: https://www.postgresql.org/docs/current/indexes.html
- MySQL Index Optimization: https://dev.mysql.com/doc/refman/8.0/en/optimization-indexes.html
- MongoDB Indexing Strategies: https://www.mongodb.com/docs/manual/indexes/
