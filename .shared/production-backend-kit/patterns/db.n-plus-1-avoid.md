---
id: db-n-plus-1-avoid
title: Avoiding N+1 Query Problem
tags:
  - database
  - performance
  - orm
  - optimization
level: intermediate
stacks:
  - all
scope: database
maturity: stable
---

# Avoiding N+1 Query Problem

## Problem

N+1 queries occur when code fetches a list, then executes one query per item to get related data. This causes 1 + N database roundtrips instead of 2, destroying performance.

## When to use

- Using any ORM (ActiveRecord, Hibernate, SQLAlchemy)
- Fetching collections with relationships
- API endpoints returning nested data
- GraphQL resolvers
- Anytime you loop and query

## Solution

1. **Identify N+1 patterns**
   - Enable query logging in development
   - Use APM or profiling tools
   - Look for loops that trigger queries

2. **Use eager loading**
   - Load relationships in initial query
   - JOIN or separate IN query
   - Specify includes/joins upfront

3. **Use DataLoader pattern**
   - Batch and dedupe requests
   - Especially for GraphQL
   - Works across single request

4. **Optimize query patterns**
   - Fetch only needed fields
   - Use subqueries or CTEs
   - Consider denormalization for reads

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
