---
id: api-idempotency-keys
title: Idempotency Keys
tags:
  - api
  - idempotency
  - reliability
  - payments
  - distributed-systems
level: intermediate
stacks:
  - all
scope: api
maturity: stable
version: 2.0.0
sources:
  - https://stripe.com/docs/api/idempotent_requests
  - https://brandur.org/idempotency-keys
  - https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/
---

# Idempotency Keys

## Problem

Network failures, timeouts, and client retries cause **duplicate operations**:
- Double charges on payments
- Duplicate orders created
- Multiple emails sent
- Inconsistent financial records

Without idempotency guarantees, clients cannot safely retry failed requests.

## When to use

- **Payment processing** (critical!)
- Order/transaction creation
- Any state-changing operation (POST, PUT, PATCH, DELETE)
- Webhook delivery systems
- Message queue consumers
- Financial transactions
- Email/notification sending

## Solution

### 1. Idempotency Key Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│ Check DB │────▶│ Process  │────▶│  Store   │
│          │     │ for Key  │     │ Request  │     │ Response │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                                  │
     │                ▼                                  │
     │         ┌──────────┐                             │
     │         │ Key Found│                             │
     │         │  Match?  │                             │
     │         └──────────┘                             │
     │           │      │                               │
     │      Yes  │      │ No                            │
     │           ▼      ▼                               │
     │      ┌────────┐ ┌────────┐                       │
     │      │ Return │ │  409   │                       │
     │      │ Cached │ │Conflict│                       │
     │      └────────┘ └────────┘                       │
     │                                                  │
     └──────────────────────────────────────────────────┘
                    Retry with same key
```

### 2. Request Headers

```http
POST /v1/payments HTTP/1.1
Host: api.example.com
Idempotency-Key: idem_8f14e45f-ceea-367a-9f10-8c4f5f3c8d8d
Content-Type: application/json

{
  "amount": 10000,
  "currency": "USD",
  "customer_id": "cus_abc123"
}
```

### 3. Key Requirements

| Requirement | Implementation |
|-------------|----------------|
| Uniqueness | UUID v4 or ULID per operation |
| Scope | Namespace by user/tenant ID |
| Fingerprint | SHA-256 of (method + path + body) |
| TTL | 24-48 hours minimum |
| Storage | Redis (speed) + DB (persistence) |

### 4. Processing States

```
┌─────────────────────────────────────────────────────────┐
│ State        │ Meaning                │ Response        │
├──────────────┼────────────────────────┼─────────────────┤
│ NOT_FOUND    │ First request          │ Process & store │
│ PROCESSING   │ In-flight (locked)     │ 409 Conflict    │
│ COMPLETED    │ Previously succeeded   │ Return cached   │
│ FAILED       │ Previously failed      │ Allow retry*    │
│ HASH_MISMATCH│ Same key, diff request │ 422 Unprocess.  │
└─────────────────────────────────────────────────────────┘

* Failed requests may allow retry with same key (configurable)
```

### 5. Storage Schema

```sql
CREATE TABLE idempotency_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(255) NOT NULL,
  user_id         UUID NOT NULL,
  request_method  VARCHAR(10) NOT NULL,
  request_path    VARCHAR(500) NOT NULL,
  request_hash    VARCHAR(64) NOT NULL,  -- SHA-256
  
  status          VARCHAR(20) NOT NULL DEFAULT 'processing',
  -- 'processing', 'completed', 'failed'
  
  response_code   INTEGER,
  response_body   JSONB,
  
  locked_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  
  UNIQUE (idempotency_key, user_id)
);

CREATE INDEX idx_idempotency_keys_lookup 
  ON idempotency_keys (idempotency_key, user_id) 
  WHERE expires_at > NOW();
```

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| Not hashing request body | Different requests return wrong cached response | Always store and compare fingerprint |
| Key reuse across users | Security breach, data leak | Scope key to user_id/tenant_id |
| Too short TTL | Retries fail after key expires | Use 24-48 hours minimum |
| No lock during processing | Race condition, double processing | Use DB row lock or Redis SETNX |
| Storing only success responses | Failed requests processed twice | Store failures too (configurable retry) |
| Ignoring in-flight requests | Concurrent duplicates | Return 409 if locked/processing |
| No cleanup | Storage bloat | Use TTL + periodic cleanup job |

## Checklist

- [ ] `Idempotency-Key` header accepted (case-insensitive)
- [ ] Key scoped to authenticated user/tenant
- [ ] Request fingerprint stored (method + path + body hash)
- [ ] Response body and status code cached
- [ ] TTL set appropriately (24-48 hours)
- [ ] Concurrent requests handled (distributed lock)
- [ ] Mismatched request returns 422 Unprocessable
- [ ] In-flight request returns 409 Conflict
- [ ] Storage is highly available (Redis/PostgreSQL)
- [ ] Key format and usage documented for API consumers
- [ ] Expired keys cleaned up automatically
- [ ] Monitoring on duplicate key hits

## Code Examples

### TypeScript/Node.js (Express + Redis)

```typescript
import crypto from 'crypto';
import Redis from 'ioredis';

const redis = new Redis();
const IDEMPOTENCY_TTL = 48 * 60 * 60; // 48 hours in seconds

interface IdempotencyRecord {
  status: 'processing' | 'completed' | 'failed';
  requestHash: string;
  responseCode?: number;
  responseBody?: any;
  createdAt: string;
}

function hashRequest(method: string, path: string, body: any): string {
  const data = JSON.stringify({ method, path, body });
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  
  // Only apply to state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }
  
  // Key is optional but recommended
  if (!idempotencyKey) {
    return next();
  }
  
  const userId = req.user.id;
  const redisKey = `idempotency:${userId}:${idempotencyKey}`;
  const requestHash = hashRequest(req.method, req.path, req.body);
  
  // Try to acquire lock (SETNX pattern)
  const existingRecord = await redis.get(redisKey);
  
  if (existingRecord) {
    const record: IdempotencyRecord = JSON.parse(existingRecord);
    
    // Request hash mismatch - client reused key incorrectly
    if (record.requestHash !== requestHash) {
      return res.status(422).json({
        type: 'https://api.example.com/errors/idempotency-mismatch',
        title: 'Idempotency Key Mismatch',
        status: 422,
        detail: 'This idempotency key was used with different request parameters',
      });
    }
    
    // Still processing - return conflict
    if (record.status === 'processing') {
      return res.status(409).json({
        type: 'https://api.example.com/errors/request-in-progress',
        title: 'Request In Progress',
        status: 409,
        detail: 'A request with this idempotency key is currently being processed',
      });
    }
    
    // Completed - return cached response
    if (record.status === 'completed') {
      return res.status(record.responseCode!).json(record.responseBody);
    }
    
    // Failed - allow retry (optional behavior)
    // Fall through to process again
  }
  
  // Store processing state with lock
  const newRecord: IdempotencyRecord = {
    status: 'processing',
    requestHash,
    createdAt: new Date().toISOString(),
  };
  
  // Use SETNX for atomic check-and-set
  const acquired = await redis.set(
    redisKey,
    JSON.stringify(newRecord),
    'EX', IDEMPOTENCY_TTL,
    'NX'
  );
  
  if (!acquired) {
    // Race condition - another request got there first
    return res.status(409).json({
      type: 'https://api.example.com/errors/request-in-progress',
      title: 'Request In Progress',
      status: 409,
      detail: 'A request with this idempotency key is currently being processed',
    });
  }
  
  // Capture response to store
  const originalJson = res.json.bind(res);
  res.json = function(body: any) {
    // Store completed state
    const completedRecord: IdempotencyRecord = {
      status: res.statusCode >= 400 ? 'failed' : 'completed',
      requestHash,
      responseCode: res.statusCode,
      responseBody: body,
      createdAt: newRecord.createdAt,
    };
    
    redis.set(redisKey, JSON.stringify(completedRecord), 'EX', IDEMPOTENCY_TTL);
    
    return originalJson(body);
  };
  
  next();
}
```

### Python/FastAPI

```python
import hashlib
import json
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Request, Response, HTTPException
from redis.asyncio import Redis

IDEMPOTENCY_TTL = timedelta(hours=48)

async def get_idempotency_record(redis: Redis, key: str) -> Optional[dict]:
    data = await redis.get(key)
    return json.loads(data) if data else None

async def set_idempotency_record(redis: Redis, key: str, record: dict):
    await redis.set(key, json.dumps(record), ex=int(IDEMPOTENCY_TTL.total_seconds()))

def hash_request(method: str, path: str, body: bytes) -> str:
    data = f"{method}:{path}:{body.decode()}"
    return hashlib.sha256(data.encode()).hexdigest()

@app.middleware("http")
async def idempotency_middleware(request: Request, call_next):
    if request.method not in ("POST", "PUT", "PATCH", "DELETE"):
        return await call_next(request)
    
    idempotency_key = request.headers.get("idempotency-key")
    if not idempotency_key:
        return await call_next(request)
    
    user_id = request.state.user.id
    redis_key = f"idempotency:{user_id}:{idempotency_key}"
    body = await request.body()
    request_hash = hash_request(request.method, request.url.path, body)
    
    existing = await get_idempotency_record(redis, redis_key)
    
    if existing:
        if existing["request_hash"] != request_hash:
            raise HTTPException(
                status_code=422,
                detail="Idempotency key was used with different request parameters"
            )
        
        if existing["status"] == "processing":
            raise HTTPException(
                status_code=409,
                detail="Request with this idempotency key is in progress"
            )
        
        if existing["status"] == "completed":
            return Response(
                content=json.dumps(existing["response_body"]),
                status_code=existing["response_code"],
                media_type="application/json"
            )
    
    # Acquire lock
    acquired = await redis.set(
        redis_key,
        json.dumps({
            "status": "processing",
            "request_hash": request_hash,
            "created_at": datetime.utcnow().isoformat()
        }),
        ex=int(IDEMPOTENCY_TTL.total_seconds()),
        nx=True
    )
    
    if not acquired:
        raise HTTPException(status_code=409, detail="Request in progress")
    
    # Process request
    response = await call_next(request)
    
    # Store result
    response_body = b"".join([chunk async for chunk in response.body_iterator])
    await set_idempotency_record(redis, redis_key, {
        "status": "completed" if response.status_code < 400 else "failed",
        "request_hash": request_hash,
        "response_code": response.status_code,
        "response_body": json.loads(response_body) if response_body else None,
        "created_at": datetime.utcnow().isoformat()
    })
    
    return Response(
        content=response_body,
        status_code=response.status_code,
        headers=dict(response.headers),
        media_type=response.media_type
    )
```

## References

- [Stripe - Idempotent Requests](https://stripe.com/docs/api/idempotent_requests)
- [Brandur - Implementing Stripe-like Idempotency Keys](https://brandur.org/idempotency-keys)
- [AWS - Making Retries Safe with Idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
- [PayPal - Idempotency](https://developer.paypal.com/docs/api/reference/api-responses/#link-idempotency)
