---
id: api-webhooks-signatures
title: Webhook Signatures
tags:
  - api
  - webhooks
  - security
  - signatures
level: intermediate
stacks:
  - all
scope: api
maturity: stable
---

# Webhook Signatures

## Problem

Webhooks can be spoofed by attackers sending fake payloads to your endpoints. Without signature verification, your system may process malicious or forged events.

## When to use

- Receiving webhooks from any external service
- Building webhook delivery systems
- Payment processor callbacks
- GitHub/GitLab event hooks
- Any event-driven integration

## Solution

1. **Signing (sender side)**
   - Generate HMAC-SHA256 of payload
   - Use shared secret per consumer
   - Include timestamp to prevent replay
   - Send signature in header

2. **Verification (receiver side)**
   - Extract signature from header
   - Recompute HMAC with your secret
   - Compare signatures (constant-time)
   - Validate timestamp freshness (5-minute window)

3. **Replay protection**
   - Include timestamp in signed payload
   - Reject events older than tolerance window
   - Optionally store event IDs for dedup

4. **Secret rotation**
   - Support multiple active secrets
   - Grace period during rotation
   - Notify consumers before rotation

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Using simple string compare | Use constant-time comparison |
| No timestamp validation | Check event is within 5-minute window |
| Sharing secret across consumers | Unique secret per webhook endpoint |
| Not logging verification failures | Track for security monitoring |
| Ignoring replay attacks | Store event IDs or use timestamps |

## Checklist

- [ ] HMAC-SHA256 used for signatures
- [ ] Unique secret per consumer/endpoint
- [ ] Signature sent in secure header
- [ ] Constant-time comparison used
- [ ] Timestamp included and validated
- [ ] Replay window enforced (5 min typical)
- [ ] Failed verifications logged with context
- [ ] Secret rotation mechanism in place
- [ ] Multiple secrets supported during rotation
- [ ] Signature scheme documented

## Snippets (Generic)

```
Signature Generation (Sender):
1. Create payload: { "event": "payment.completed", "data": {...}, "timestamp": 1642000000 }
2. Stringify payload (canonical JSON)
3. Compute: signature = HMAC-SHA256(secret, timestamp + "." + payload)
4. Send header: X-Signature: t=1642000000,v1=abc123...

Signature Verification (Receiver):
1. Extract header: t=1642000000,v1=abc123...
2. Parse timestamp and signature
3. Check: abs(now - timestamp) < 300 seconds
4. Compute expected: HMAC-SHA256(secret, timestamp + "." + raw_body)
5. Compare: constant_time_equal(expected, received_signature)
6. If mismatch → 401 Unauthorized

Header Format (Stripe-style):
X-Signature: t=1642000000,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
```

## Sources

- Stripe Webhook Signatures: https://stripe.com/docs/webhooks/signatures
- GitHub Webhook Secrets: https://docs.github.com/en/webhooks/securing
- Twilio Request Validation: https://www.twilio.com/docs/usage/security
- OWASP Webhook Security: https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html
