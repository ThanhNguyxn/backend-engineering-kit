---
id: rel-dlq-basics
title: Dead Letter Queue Basics
tags: [reliability, dlq, messaging, error-handling]
level: intermediate
stacks: [all]
---

# Dead Letter Queue Basics

## Problem

Messages that repeatedly fail processing can block queues, causing backlog and preventing healthy messages from being processed. You need a way to isolate problematic messages for later analysis.

## When to use

- Any message queue or event-driven system
- Background job processing
- Webhook handling
- Event sourcing
- Async task execution

## Solution

1. **Configure DLQ routing**
   - Route failed messages after N retries
   - Preserve original message + metadata
   - Add failure context (error, attempts, timestamp)

2. **Define failure criteria**
   - Max retry count exceeded
   - Specific exception types
   - Message expired (TTL)

3. **Monitor and alert**
   - Track DLQ depth
   - Alert on sudden spikes
   - Set up dashboards

4. **Handle DLQ messages**
   - Manual review and fix
   - Automated replay after fix
   - Archive or delete after analysis

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| DLQ grows unbounded | Set retention/TTL, regular cleanup |
| No alerting on DLQ | Monitor depth, alert on threshold |
| Losing failure context | Store original message + error info |
| No replay mechanism | Build tooling to replay from DLQ |
| Retrying without fixing | Analyze root cause before replay |

## Checklist

- [ ] DLQ configured for each queue
- [ ] Max retry count defined before DLQ
- [ ] Original message preserved in DLQ
- [ ] Failure context stored (error, traces)
- [ ] DLQ depth monitored and alerted
- [ ] Retention policy for DLQ messages
- [ ] Replay mechanism available
- [ ] DLQ messages auditable
- [ ] Root cause analysis process defined
- [ ] Runbook for DLQ handling

## Snippets (Generic)

```
DLQ Message Structure:
{
  "original_message": {
    "type": "OrderCreated",
    "payload": { "orderId": 123, "amount": 100 }
  },
  "failure_context": {
    "queue": "orders",
    "first_failure": "2026-01-14T10:00:00Z",
    "last_failure": "2026-01-14T10:05:00Z",
    "attempt_count": 5,
    "last_error": "ValidationError: Invalid product ID",
    "stack_trace": "...",
    "correlation_id": "corr_abc123"
  }
}

Message Flow:
Main Queue ─┬─► Success ─► Done
            │
            └─► Failure ─► Retry (up to N times)
                              │
                              └─► DLQ (after N failures)

DLQ Handling Process:
1. Alert received: DLQ depth > threshold
2. Investigate sample messages
3. Identify root cause (bug, bad data, dependency)
4. Fix the issue
5. Replay messages from DLQ
6. Monitor for success
7. Archive processed DLQ messages

AWS SQS DLQ Config (pseudo):
main_queue:
  redrive_policy:
    dead_letter_queue: dlq_arn
    max_receive_count: 5

RabbitMQ DLQ Config (pseudo):
exchange: orders-exchange
queue: orders-queue
  arguments:
    x-dead-letter-exchange: orders-dlx
    x-dead-letter-routing-key: orders-dlq

DLQ Tooling Commands:
# View DLQ messages
dlq-tool list --queue orders-dlq --limit 10

# Replay single message
dlq-tool replay --queue orders-dlq --message-id msg_123

# Replay all (after fix deployed)
dlq-tool replay-all --queue orders-dlq --dry-run
```

## Sources

- AWS SQS Dead Letter Queues: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html
- RabbitMQ Dead Letter Exchanges: https://www.rabbitmq.com/docs/dlx
- Azure Service Bus DLQ: https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-dead-letter-queues
- Kafka Error Handling: https://www.confluent.io/blog/error-handling-patterns-in-kafka/
