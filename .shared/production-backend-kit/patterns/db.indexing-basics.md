---
id: db-indexing-basics
title: Database Indexing Basics
tags: [database, indexing, performance, query-optimization]
level: intermediate
stacks: [postgresql, mysql, sqlserver, mongodb]
---

# Database Indexing Basics

## Problem

Queries on large tables without proper indexes result in full table scans, causing slow response times, high CPU usage, and poor user experience. Over-indexing wastes disk space and slows writes.

## When to use

- Columns used in WHERE clauses
- Columns used in JOIN conditions
- Columns used in ORDER BY / GROUP BY
- Foreign key columns
- Columns with high selectivity

## Solution

1. **Identify query patterns**
   - Analyze slow query logs
   - Review application queries
   - Use EXPLAIN/EXPLAIN ANALYZE

2. **Choose index type**
   - B-tree: Default, works for most cases
   - Hash: Equality comparisons only
   - GIN/GiST: Full-text, JSONB, arrays
   - Partial: Subset of rows

3. **Create composite indexes**
   - Order columns by selectivity
   - Include all columns for covering index
   - Match query patterns exactly

4. **Monitor and maintain**
   - Track index usage statistics
   - Remove unused indexes
   - Rebuild fragmented indexes

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
