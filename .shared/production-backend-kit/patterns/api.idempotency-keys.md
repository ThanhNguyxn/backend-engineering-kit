---
id: api-idempotency-keys
title: Idempotency Keys
tags:
  - api
  - idempotency
  - reliability
  - payments
level: intermediate
stacks:
  - all
scope: api
maturity: stable
---

# Idempotency Keys

## Problem

Network failures and client retries can cause duplicate operations—duplicate payments, double orders, or repeated emails. Without idempotency, retrying safe operations becomes dangerous.

## When to use

- Payment processing APIs
- Order creation endpoints
- Any non-idempotent operation (POST/PATCH)
- Webhook delivery systems
- Message queue consumers
- Financial transactions

## Solution

1. **Accept idempotency key from client**
   - Header: `Idempotency-Key: <uuid>`
   - Client generates unique key per operation
   - Key should be UUID or similar unique string

2. **Store request-response mapping**
   - Key: idempotency key + user/tenant
   - Value: request hash + response + status
   - TTL: 24-48 hours typical

3. **Processing logic**
   - Check if key exists
   - If exists and request matches → return stored response
   - If exists and request differs → return 422 Conflict
   - If not exists → process, store result, return

4. **Handle in-flight requests**
   - Lock on idempotency key during processing
   - Return 409 if same key is in-flight

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Not hashing request body | Store and compare request fingerprint |
| Too short TTL | Use 24-48 hours minimum |
| Key reuse across users | Scope key to user/tenant |
| No lock during processing | Use distributed lock or DB row lock |
| Ignoring in-flight requests | Return 409 Conflict |

## Checklist

- [ ] Idempotency-Key header accepted
- [ ] Key scoped to user/tenant
- [ ] Request fingerprint stored with key
- [ ] Response cached for replay
- [ ] TTL set appropriately (24-48h)
- [ ] Concurrent requests handled (locking)
- [ ] Mismatched request returns 422
- [ ] In-flight request returns 409
- [ ] Storage is highly available (Redis/DB)
- [ ] Key format documented for clients

## Snippets (Generic)

```
Client Request:
POST /v1/payments
Idempotency-Key: idem_a1b2c3d4
Content-Type: application/json
{ "amount": 1000, "currency": "USD" }

Processing Flow:
1. Receive request with Idempotency-Key
2. Hash: SHA256(method + path + body)
3. Check cache/DB for key
   - Found + hash matches → return cached response
   - Found + hash differs → return 422 Conflict
   - Not found → continue
4. Acquire lock on key
5. Process request
6. Store: { key, hash, response, status, expires_at }
7. Release lock, return response

Storage Schema:
{
  "key": "user_123:idem_a1b2c3d4",
  "request_hash": "sha256...",
  "response": { ... },
  "status_code": 201,
  "created_at": "...",
  "expires_at": "..."
}
```

## Sources

- Stripe Idempotent Requests: https://stripe.com/docs/api/idempotent_requests
- Designing Robust Idempotency Keys (Brandur): https://brandur.org/idempotency-keys
- Amazon API Gateway Idempotency: https://docs.aws.amazon.com/lambda/latest/dg/invocation-retries.html
- PayPal Idempotency: https://developer.paypal.com/docs/api/reference/api-responses/
