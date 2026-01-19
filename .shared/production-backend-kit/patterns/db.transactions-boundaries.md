---
id: db-transactions-boundaries
title: Transaction Boundaries
tags:
  - database
  - transactions
  - acid
  - consistency
  - isolation
level: intermediate
stacks:
  - all
scope: database
maturity: stable
version: 2.0.0
sources:
  - https://www.postgresql.org/docs/current/transaction-iso.html
  - https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html
  - https://jepsen.io/consistency
---

# Transaction Boundaries

## Problem

Incorrect transaction boundaries lead to partial updates, data inconsistency, and race conditions. Too-long transactions cause lock contention; too-short transactions cause inconsistent state. Understanding isolation levels is critical for correctness.

## When to use

- Multiple related writes that must succeed together
- Read-modify-write operations
- Business operations with consistency requirements
- Cross-table updates
- Financial or inventory operations

## Solution

### 1. Transaction Boundary Rules

| Rule | Description |
|------|-------------|
| **One business operation** | Transaction = one logical operation |
| **Keep short** | Target < 1 second, max 30 seconds |
| **No external calls** | HTTP, queue, file I/O outside transaction |
| **Atomic write batches** | Group related writes |
| **Explicit boundaries** | Don't rely on auto-commit |

### 2. Isolation Levels

| Level | Dirty Read | Non-Repeatable Read | Phantom Read | Use Case |
|-------|------------|---------------------|--------------|----------|
| **Read Uncommitted** | ✔ | ✔ | ✔ | Never use |
| **Read Committed** | ✖ | ✔ | ✔ | Default, most apps |
| **Repeatable Read** | ✖ | ✖ | ✔* | Reports, analytics |
| **Serializable** | ✖ | ✖ | ✖ | Financial, critical |

*PostgreSQL's Repeatable Read also prevents phantoms.

```sql
-- PostgreSQL: Set for session
SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- Or per transaction
BEGIN ISOLATION LEVEL SERIALIZABLE;
  -- operations
COMMIT;
```

### 3. Implementation Patterns

**Basic Transaction (TypeScript/Prisma):**
```typescript
async function transferFunds(
  fromAccountId: string,
  toAccountId: string,
  amount: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Debit source account
    const from = await tx.account.update({
      where: { id: fromAccountId },
      data: { balance: { decrement: amount } },
    });
    
    if (from.balance < 0) {
      throw new InsufficientFundsError();
    }
    
    // Credit destination account
    await tx.account.update({
      where: { id: toAccountId },
      data: { balance: { increment: amount } },
    });
    
    // Record transfer
    await tx.transfer.create({
      data: { fromAccountId, toAccountId, amount },
    });
  }, {
    isolationLevel: 'Serializable',
    timeout: 10000, // 10 seconds max
  });
}
```

**Optimistic Locking:**
```typescript
async function updateOrderWithOptimisticLock(
  orderId: string,
  updates: Partial<Order>,
  expectedVersion: number
): Promise<Order> {
  const result = await prisma.order.updateMany({
    where: {
      id: orderId,
      version: expectedVersion, // Only update if version matches
    },
    data: {
      ...updates,
      version: { increment: 1 },
    },
  });
  
  if (result.count === 0) {
    throw new OptimisticLockError(
      'Order was modified by another process. Please retry.'
    );
  }
  
  return prisma.order.findUnique({ where: { id: orderId } });
}
```

**SELECT FOR UPDATE (Pessimistic Locking):**
```typescript
async function processInventory(productId: string, quantity: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Lock the row for update
    const [inventory] = await tx.$queryRaw<Inventory[]>`
      SELECT * FROM inventory 
      WHERE product_id = ${productId}
      FOR UPDATE NOWAIT
    `;
    
    if (!inventory || inventory.quantity < quantity) {
      throw new InsufficientInventoryError();
    }
    
    await tx.inventory.update({
      where: { productId },
      data: { quantity: { decrement: quantity } },
    });
  });
}
```

### 4. Deadlock Handling

```typescript
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if deadlock or serialization failure
      const isRetryable = 
        error.code === '40001' || // Serialization failure (Postgres)
        error.code === '40P01' || // Deadlock detected (Postgres)
        error.code === 'ER_LOCK_DEADLOCK'; // MySQL deadlock
      
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const delay = Math.min(100 * Math.pow(2, attempt), 5000);
      const jitter = Math.random() * delay * 0.1;
      await sleep(delay + jitter);
      
      logger.warn({ attempt, error: error.code }, 'Retrying after deadlock');
    }
  }
  
  throw lastError!;
}

// Usage
await executeWithRetry(() => transferFunds(from, to, amount));
```

### 5. Anti-Patterns to Avoid

```typescript
// ❌ BAD: External call inside transaction
await prisma.$transaction(async (tx) => {
  await tx.order.update({ where: { id }, data: { status: 'paid' } });
  await stripe.charges.create({ amount: 1000 }); // HTTP call!
  await tx.payment.create({ data: { orderId: id } });
});

// ✅ GOOD: External call outside, use outbox pattern
const order = await prisma.$transaction(async (tx) => {
  const order = await tx.order.update({ where: { id }, data: { status: 'processing' } });
  // Write to outbox for later processing
  await tx.outbox.create({
    data: {
      eventType: 'OrderPaymentRequested',
      payload: { orderId: id, amount: 1000 },
    },
  });
  return order;
});
// Background worker processes outbox and calls Stripe
```

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
