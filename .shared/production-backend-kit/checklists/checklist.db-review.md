---
id: checklist-db-review
title: Database Review Checklist
description: Production-grade database schema and query review checklist
category: checklists
tags:
  - database
  - schema
  - performance
  - review
version: 1.0.0
scope: database
level: intermediate
maturity: stable
stacks:
  - all
---

# Database Review Checklist

Use this checklist when reviewing database changes before deployment.

---

## 🗂️ Schema Design

- [ ] Every table has a primary key
- [ ] Foreign keys defined with appropriate ON DELETE action
- [ ] NOT NULL constraint on required columns
- [ ] Unique constraints on business keys
- [ ] Check constraints for enums and ranges
- [ ] Column types match expected data (avoid TEXT for everything)

## 📊 Indexing

- [ ] Foreign key columns indexed
- [ ] Columns in WHERE clauses indexed
- [ ] Composite index column order matches query patterns
- [ ] No duplicate or unused indexes
- [ ] EXPLAIN ANALYZE run on critical queries

## 🔄 Migrations

- [ ] Migration has both UP and DOWN scripts
- [ ] Non-destructive changes preferred (add, don't remove)
- [ ] Large data updates batched to avoid locks
- [ ] Indexes created CONCURRENTLY (if supported)
- [ ] Tested on production-like data volume

## ⚡ Performance

- [ ] N+1 query problem avoided (eager loading used)
- [ ] Queries avoid SELECT * (explicit columns)
- [ ] Connection pooling configured
- [ ] Query timeout set
- [ ] Slow query logging enabled

## 🔒 Data Integrity

- [ ] Transactions wrap multi-step operations
- [ ] Soft delete considered for recoverable data
- [ ] Audit trail for sensitive changes
- [ ] Backup strategy verified

---

## Sources

- PostgreSQL Performance Tips: https://www.postgresql.org/docs/current/performance-tips.html
- Use The Index, Luke: https://use-the-index-luke.com/
- Designing Data-Intensive Applications (Kleppmann): https://dataintensive.net/
