---
id: sec-rate-limiting
title: Rate Limiting
tags:
  - security
  - rate-limiting
  - ddos
  - availability
  - redis
level: intermediate
stacks:
  - all
scope: security
maturity: stable
version: 2.0.0
sources:
  - https://stripe.com/blog/rate-limiters
  - https://cloud.google.com/architecture/rate-limiting-strategies-techniques
  - https://redis.io/commands/incr/#pattern-rate-limiter
---

# Rate Limiting

## Problem

Without rate limiting, malicious users or buggy clients can overwhelm your API with requests, causing denial of service, increased costs, and degraded experience for legitimate users. It's also a key defense against credential stuffing and brute force attacks.

## When to use

- All public APIs
- Authentication endpoints (login, password reset, MFA)
- Resource-intensive operations (search, export)
- Paid API tiers with quotas
- Protecting against scraping and abuse

## Solution

### 1. Rate Limiting Algorithms

| Algorithm | Pros | Cons | Best For |
|-----------|------|------|----------|
| **Token Bucket** | Allows bursts, smooth | Slightly complex | APIs with burst traffic |
| **Sliding Window** | Fair distribution | Memory overhead | General use |
| **Fixed Window** | Simple | Boundary burst problem | Simple use cases |
| **Leaky Bucket** | Smooth output rate | No burst handling | Strict rate control |

### 2. Token Bucket Implementation

```typescript
import Redis from 'ioredis';

const redis = new Redis();

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

async function tokenBucketRateLimit(
  key: string,
  capacity: number,      // Max tokens (burst size)
  refillRate: number,    // Tokens per second
  tokensRequired: number = 1
): Promise<RateLimitResult> {
  const now = Date.now();
  const bucketKey = `ratelimit:${key}`;
  
  // Lua script for atomic operation
  const result = await redis.eval(`
    local bucket = redis.call('HMGET', KEYS[1], 'tokens', 'lastRefill')
    local tokens = tonumber(bucket[1]) or ARGV[1]
    local lastRefill = tonumber(bucket[2]) or ARGV[4]
    
    -- Refill tokens based on time passed
    local elapsed = (ARGV[4] - lastRefill) / 1000
    local refill = elapsed * ARGV[2]
    tokens = math.min(ARGV[1], tokens + refill)
    
    -- Try to consume tokens
    local allowed = 0
    if tokens >= ARGV[3] then
      tokens = tokens - ARGV[3]
      allowed = 1
    end
    
    -- Update bucket
    redis.call('HMSET', KEYS[1], 'tokens', tokens, 'lastRefill', ARGV[4])
    redis.call('EXPIRE', KEYS[1], ARGV[5])
    
    return {allowed, tokens}
  `, 1, bucketKey, capacity, refillRate, tokensRequired, now, 3600) as [number, number];
  
  return {
    allowed: result[0] === 1,
    remaining: Math.floor(result[1]),
    resetAt: now + Math.ceil((capacity - result[1]) / refillRate) * 1000,
  };
}
```

### 3. Sliding Window Counter (Simpler)

```typescript
async function slidingWindowRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowKey = `ratelimit:${key}:${Math.floor(now / 1000 / windowSeconds)}`;
  const prevWindowKey = `ratelimit:${key}:${Math.floor(now / 1000 / windowSeconds) - 1}`;
  
  const [current, previous] = await redis.mget(windowKey, prevWindowKey);
  
  // Weight previous window by remaining time
  const windowStart = Math.floor(now / 1000 / windowSeconds) * windowSeconds * 1000;
  const elapsed = (now - windowStart) / (windowSeconds * 1000);
  const weightedCount = (parseInt(current || '0') + 
    parseInt(previous || '0') * (1 - elapsed));
  
  if (weightedCount >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: windowStart + windowSeconds * 1000,
    };
  }
  
  await redis.incr(windowKey);
  await redis.expire(windowKey, windowSeconds * 2);
  
  return {
    allowed: true,
    remaining: Math.floor(limit - weightedCount - 1),
    resetAt: windowStart + windowSeconds * 1000,
  };
}
```

### 4. Rate Limit Middleware

```typescript
import { RateLimiterRedis } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl',
  points: 100,        // 100 requests
  duration: 60,       // per 60 seconds
  blockDuration: 60,  // Block for 60s if exceeded
});

const strictLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:auth',
  points: 5,          // 5 attempts
  duration: 60,       // per minute
  blockDuration: 300, // Block for 5 minutes
});

function rateLimitMiddleware(limiter: RateLimiterRedis) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.user?.id || req.ip; // User ID or IP
    
    try {
      const result = await limiter.consume(key);
      
      res.set({
        'X-RateLimit-Limit': limiter.points,
        'X-RateLimit-Remaining': result.remainingPoints,
        'X-RateLimit-Reset': new Date(Date.now() + result.msBeforeNext).toISOString(),
      });
      
      next();
    } catch (rateLimitRes) {
      res.set({
        'X-RateLimit-Limit': limiter.points,
        'X-RateLimit-Remaining': 0,
        'X-RateLimit-Reset': new Date(Date.now() + rateLimitRes.msBeforeNext).toISOString(),
        'Retry-After': Math.ceil(rateLimitRes.msBeforeNext / 1000),
      });
      
      res.status(429).json({
        error: 'Too Many Requests',
        retryAfter: Math.ceil(rateLimitRes.msBeforeNext / 1000),
      });
    }
  };
}

// Usage
app.use('/api', rateLimitMiddleware(rateLimiter));
app.post('/api/login', rateLimitMiddleware(strictLimiter), loginHandler);
```

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Only IP-based limiting | Combine with API key/user limits |
| Not handling authenticated users | Different limits for auth vs anon |
| Blocking on Redis failure | Fail open with logging, or local fallback |
| Harsh limits on first deploy | Start lenient, tighten based on data |
| No burst allowance | Token bucket allows reasonable bursts |

## Checklist

- [ ] Rate limit algorithm chosen
- [ ] Limits defined per scope (global, user, IP)
- [ ] Login/auth endpoints have stricter limits
- [ ] 429 response returned with Retry-After
- [ ] Rate limit headers included in responses
- [ ] Distributed storage (Redis) configured
- [ ] Failure mode defined (open/closed)
- [ ] Limits documented for consumers
- [ ] Monitoring alerts on rate limit hits
- [ ] Different limits for API tiers

## Snippets (Generic)

```
Response Headers:
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1642000000
Retry-After: 60

Token Bucket Algorithm:
1. Bucket holds N tokens (capacity)
2. Tokens added at rate R per second
3. Each request consumes 1 token
4. If no tokens → reject with 429
5. Allows bursts up to capacity

Redis Rate Limiter (pseudo):
key = "rate_limit:{user_id}:{window}"
current = redis.incr(key)
if current == 1:
  redis.expire(key, window_seconds)
if current > limit:
  return 429

Sliding Window:
1. Count requests in last N seconds
2. Use sorted set with request timestamps
3. Remove expired entries
4. Check count against limit

Typical Limits:
- Anonymous: 100/minute per IP
- Authenticated: 1000/minute per user
- Login attempts: 5/minute per IP
- Password reset: 3/hour per email
- Expensive operations: 10/minute per user
```

## Sources

- Stripe Rate Limiting: https://stripe.com/blog/rate-limiters
- Cloudflare Rate Limiting: https://developers.cloudflare.com/waf/rate-limiting-rules/
- Redis Rate Limiting Patterns: https://redis.io/commands/incr/#pattern-rate-limiter
- Token Bucket Algorithm: https://en.wikipedia.org/wiki/Token_bucket
