---
id: db-n-plus-1-avoid
title: Avoiding N+1 Query Problem
tags:
  - database
  - performance
  - orm
  - optimization
  - dataloader
level: intermediate
stacks:
  - all
scope: database
maturity: stable
version: 2.0.0
sources:
  - https://github.com/graphql/dataloader
  - https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html
  - https://guides.rubyonrails.org/active_record_querying.html#eager-loading-associations
---

# Avoiding N+1 Query Problem

## Problem

N+1 queries occur when code fetches a list, then executes one query per item to get related data. This causes 1 + N database roundtrips instead of 2, destroying performance. With 1000 items, you make 1001 queries instead of 2.

## When to use

- Using any ORM (Prisma, Drizzle, TypeORM, SQLAlchemy, Hibernate)
- Fetching collections with relationships
- API endpoints returning nested data
- GraphQL resolvers
- Anytime you loop and query

## Solution

### 1. Identify N+1 Patterns

**Symptoms**:
- Endpoint latency scales linearly with result size
- Query log shows repeated similar queries
- APM shows high query count per request

**Detection Tools**:
- PostgreSQL: `pg_stat_statements`
- Node.js: `DEBUG=knex:query`
- Python: SQLAlchemy echo mode
- Ruby: Bullet gem
- Java: Hibernate statistics

### 2. Eager Loading (ORM)

```typescript
// Prisma - Bad (N+1)
const users = await prisma.user.findMany();
for (const user of users) {
  const orders = await prisma.order.findMany({ where: { userId: user.id } });
}

// Prisma - Good (2 queries)
const users = await prisma.user.findMany({
  include: { orders: true }
});
```

```python
# SQLAlchemy - Bad (N+1)
users = session.query(User).all()
for user in users:
    print(user.orders)  # Triggers query each time!

# SQLAlchemy - Good (eager load)
users = session.query(User).options(joinedload(User.orders)).all()
```

### 3. DataLoader Pattern (GraphQL)

Batch and dedupe requests within a single tick:

```typescript
// DataLoader batches all user.id lookups
const userLoader = new DataLoader(async (userIds: string[]) => {
  const users = await db.user.findMany({
    where: { id: { in: userIds } }
  });
  // Return in same order as input
  const userMap = new Map(users.map(u => [u.id, u]));
  return userIds.map(id => userMap.get(id));
});

// In resolver
const resolvers = {
  Order: {
    user: (order, _, { loaders }) => loaders.user.load(order.userId)
  }
};
```

### 4. Raw SQL Solutions

```sql
-- Instead of N+1:
SELECT * FROM users;  -- 1 query
SELECT * FROM orders WHERE user_id = 1;  -- N queries
SELECT * FROM orders WHERE user_id = 2;
...

-- Use JOIN (1 query, may duplicate user data):
SELECT u.*, o.* FROM users u
LEFT JOIN orders o ON o.user_id = u.id;

-- Or IN clause (2 queries, cleaner):
SELECT * FROM users;
SELECT * FROM orders WHERE user_id IN (1, 2, 3, ...);
```

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Over-eager loading | Only load what you need |
| Lazy loading by default | Configure ORM for explicit loading |
| Not monitoring queries | Enable query logging always |
| Ignoring in tests | Tests often hide N+1 (small data) |
| Nested N+1 | Check all relationship levels |

## Checklist

- [ ] Query logging enabled in development
- [ ] N+1 detection tool configured
- [ ] Eager loading used for known relationships
- [ ] DataLoader used for GraphQL (or similar)
- [ ] Code review checks for loops with queries
- [ ] Lazy loading avoided by default
- [ ] APM tracks query counts per request
- [ ] Benchmarks use realistic data volume
- [ ] SELECT fields limited to needed columns
- [ ] Complex queries reviewed by DBA

## Snippets (Generic)

```
N+1 Problem Example:
-- First query: get all orders
SELECT * FROM orders;

-- Then for EACH order (N times):
SELECT * FROM users WHERE id = ?;  -- Called N times!

Fixed with Eager Loading:
-- Option 1: JOIN
SELECT orders.*, users.* 
FROM orders 
JOIN users ON orders.user_id = users.id;

-- Option 2: Separate IN query (2 queries total)
SELECT * FROM orders;
SELECT * FROM users WHERE id IN (1, 2, 3, 4, 5);

ORM Eager Loading (pseudo):
-- Bad
orders = Order.all()
for order in orders:
  print(order.user.name)  # Triggers query each time!

-- Good
orders = Order.all().include('user')  # or .prefetch_related()
for order in orders:
  print(order.user.name)  # No additional queries

DataLoader Pattern:
1. Collect all user_ids needed in request
2. Batch into single query: WHERE id IN (...)
3. Return results mapped by id
4. Each resolver gets pre-fetched data

Detection Steps:
1. Enable query logging
2. Run typical request
3. Count queries (should be ~2-3 for list endpoint)
4. If queries ~ item count, you have N+1
5. Add eager loading or DataLoader
```

## Sources

- Rails Bullet Gem: https://github.com/flyerhzm/bullet
- SQLAlchemy Eager Loading: https://docs.sqlalchemy.org/en/14/orm/loading_relationships.html
- GraphQL DataLoader: https://github.com/graphql/dataloader
- Django select_related/prefetch_related: https://docs.djangoproject.com/en/5.0/ref/models/querysets/#select-related
