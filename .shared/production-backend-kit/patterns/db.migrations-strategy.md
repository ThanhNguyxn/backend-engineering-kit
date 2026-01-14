---
id: db-migrations-strategy
title: Database Migrations Strategy
tags: [database, migrations, schema, devops]
level: intermediate
stacks: [all]
---

# Database Migrations Strategy

## Problem

Unmanaged schema changes cause deployment failures, data loss, and environment drift. Without migration strategy, rolling back is painful and synchronizing schemas across environments is error-prone.

## When to use

- Any application with database
- Multi-environment deployments (dev, staging, prod)
- Team collaboration on schema
- CI/CD pipelines
- Blue-green or rolling deployments

## Solution

1. **Use migration tool**
   - Version-controlled migrations
   - Track applied migrations in DB table
   - Popular: Flyway, Liquibase, Alembic, Knex

2. **Write safe migrations**
   - One change per migration
   - Always provide rollback
   - Make migrations idempotent when possible
   - Test data migrations separately

3. **Deploy safely**
   - Run migrations before app deployment
   - Separate destructive changes
   - Use expand-contract pattern for zero-downtime

4. **Handle production data**
   - Backup before major migrations
   - Test on production-like data volume
   - Use batching for large updates
   - Monitor during migration

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
