---
id: db-transactions-boundaries
title: Transaction Boundaries
tags:
  - database
  - transactions
  - acid
  - consistency
level: intermediate
stacks:
  - all
scope: database
maturity: stable
---

# Transaction Boundaries

## Problem

Incorrect transaction boundaries lead to partial updates, data inconsistency, and race conditions. Too-long transactions cause lock contention; too-short transactions cause inconsistent state.

## When to use

- Multiple related writes that must succeed together
- Read-modify-write operations
- Business operations with consistency requirements
- Cross-table updates
- Financial or inventory operations

## Solution

1. **Define clear boundaries**
   - Transaction = one business operation
   - Keep transactions as short as possible
   - Group related writes together

2. **Choose isolation level**
   - Read Committed: Default, prevents dirty reads
   - Repeatable Read: Prevents non-repeatable reads
   - Serializable: Strongest, prevents phantoms

3. **Handle errors properly**
   - Rollback on any error
   - Don't catch and ignore DB errors
   - Retry transient failures with backoff

4. **Optimize for performance**
   - Avoid external calls inside transactions
   - Use optimistic locking when possible
   - Batch operations when appropriate

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| HTTP calls inside transaction | Move external calls outside |
| Long-running transactions | Keep transactions short (< 1 sec) |
| Not handling deadlocks | Implement retry logic |
| Mixing read-write isolation | Understand isolation trade-offs |
| Auto-commit mode surprises | Explicitly manage transactions |

## Checklist

- [ ] Transaction boundaries match business operations
- [ ] Transactions kept as short as possible
- [ ] No external calls inside transactions
- [ ] Isolation level explicitly chosen
- [ ] Error handling includes rollback
- [ ] Deadlock retry logic implemented
- [ ] Optimistic locking used where appropriate
- [ ] Connection pool sized correctly
- [ ] Transaction timeouts configured
- [ ] Nested transactions avoided or handled

## Snippets (Generic)

```
Basic Transaction Pattern:
BEGIN TRANSACTION;
  UPDATE accounts SET balance = balance - 100 WHERE id = 1;
  UPDATE accounts SET balance = balance + 100 WHERE id = 2;
  INSERT INTO transfers (from_id, to_id, amount) VALUES (1, 2, 100);
COMMIT;
-- On any error: ROLLBACK;

Application Code Pattern:
try:
  tx = db.begin_transaction()
  account_from = tx.update(account1, balance=balance - amount)
  account_to = tx.update(account2, balance=balance + amount)
  tx.insert(Transfer(from=1, to=2, amount=amount))
  tx.commit()
except Exception:
  tx.rollback()
  raise

Optimistic Locking:
UPDATE products 
SET quantity = quantity - 1, version = version + 1
WHERE id = 123 AND version = 5;
-- If affected_rows == 0, retry (someone else updated)

Isolation Levels:
- READ UNCOMMITTED: Dirty reads possible (avoid!)
- READ COMMITTED: Only committed data visible
- REPEATABLE READ: Snapshot at transaction start
- SERIALIZABLE: Full isolation, may have failures

Steps:
1. Identify business operation boundaries
2. Wrap related writes in single transaction
3. Choose appropriate isolation level
4. Add error handling with rollback
5. Implement retry for transient failures
6. Monitor for lock contention
```

## Sources

- PostgreSQL Transaction Isolation: https://www.postgresql.org/docs/current/transaction-iso.html
- Martin Kleppmann - Designing Data-Intensive Applications: https://dataintensive.net/
- MySQL Transaction Management: https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-model.html
- Jepsen Analysis (Consistency Testing): https://jepsen.io/analyses
