---
id: rel-outbox-pattern
title: Outbox Pattern
tags: [reliability, outbox, eventual-consistency, distributed]
level: advanced
stacks: [all]
---

# Outbox Pattern

## Problem

In distributed systems, you often need to update a database AND publish an event atomically. Without coordination, you risk data inconsistency—either the event is lost or published without the DB change.

## When to use

- Microservices event-driven architecture
- Database change + message publish
- Ensuring eventual consistency
- Reliable event delivery
- Avoiding dual-write problem

## Solution

1. **Write event to outbox table**
   - Same transaction as business data
   - Store event payload, status, created_at
   - Guarantees atomicity

2. **Publish from outbox**
   - Background worker reads pending events
   - Publishes to message broker
   - Marks as processed

3. **Handle failures**
   - Retry failed publications
   - Dead letter after max retries
   - Idempotent consumers required

4. **Cleanup processed events**
   - Archive or delete old events
   - Prevent table bloat

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Dual-write (DB + broker separately) | Always use transactional outbox |
| Consumer not idempotent | Design consumers for at-least-once |
| Outbox table grows unbounded | Regular cleanup/archival |
| Publisher not fault-tolerant | Retry with backoff, use DLQ |
| Wrong event ordering | Order by created_at, use sequence IDs |

## Checklist

- [ ] Outbox table in same database as business data
- [ ] Event written in same transaction as business change
- [ ] Background worker publishes pending events
- [ ] Published events marked as processed
- [ ] Failed events retried with backoff
- [ ] Dead letter queue for failed events
- [ ] Consumers are idempotent
- [ ] Cleanup job removes old events
- [ ] Outbox processing monitored
- [ ] Event ordering preserved

## Snippets (Generic)

```
Outbox Table Schema:
CREATE TABLE outbox (
  id UUID PRIMARY KEY,
  aggregate_type VARCHAR(100) NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_outbox_pending ON outbox(created_at) 
  WHERE status = 'pending';

Business Transaction:
BEGIN;
  -- Update business data
  UPDATE orders SET status = 'paid' WHERE id = 123;
  
  -- Write event to outbox (same transaction)
  INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload)
  VALUES ('order', 123, 'OrderPaid', '{"orderId": 123, "amount": 100}');
COMMIT;

Outbox Publisher (Background Worker):
while true:
  events = db.query("SELECT * FROM outbox WHERE status = 'pending' 
                     ORDER BY created_at LIMIT 100")
  
  for event in events:
    try:
      broker.publish(event.event_type, event.payload)
      db.update("UPDATE outbox SET status = 'processed', 
                 processed_at = NOW() WHERE id = ?", event.id)
    except PublishError:
      db.update("UPDATE outbox SET retry_count = retry_count + 1 
                 WHERE id = ?", event.id)
      if event.retry_count >= MAX_RETRIES:
        move_to_dlq(event)
  
  sleep(poll_interval)
```

## Sources

- Microservices Patterns (Chris Richardson) - Outbox: https://microservices.io/patterns/data/transactional-outbox.html
- Debezium Outbox Pattern: https://debezium.io/documentation/reference/transformations/outbox-event-router.html
- AWS Building Event-Driven Architectures: https://aws.amazon.com/event-driven-architecture/
- Martin Kleppmann - Designing Data-Intensive Applications: https://dataintensive.net/
