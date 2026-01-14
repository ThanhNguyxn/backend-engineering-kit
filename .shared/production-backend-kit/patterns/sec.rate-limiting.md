---
id: sec-rate-limiting
title: Rate Limiting
tags: [security, rate-limiting, ddos, availability]
level: intermediate
stacks: [all]
---

# Rate Limiting

## Problem

Without rate limiting, malicious users or buggy clients can overwhelm your API with requests, causing denial of service, increased costs, and degraded experience for legitimate users.

## When to use

- All public APIs
- Authentication endpoints (login, password reset)
- Resource-intensive operations
- Paid API tiers with quotas
- Protecting against scraping

## Solution

1. **Choose rate limiting algorithm**
   - **Token bucket**: Smooth traffic, allows bursts
   - **Sliding window**: Fair distribution over time
   - **Fixed window**: Simple but has boundary issues
   - **Leaky bucket**: Constant output rate

2. **Define limits by scope**
   - Global: Overall API protection
   - Per user/API key: Fair usage
   - Per IP: Anonymous rate limiting
   - Per endpoint: Protect expensive operations

3. **Implement response headers**
   - `X-RateLimit-Limit`: Max requests allowed
   - `X-RateLimit-Remaining`: Requests left
   - `X-RateLimit-Reset`: When limit resets
   - Return 429 Too Many Requests

4. **Use distributed storage**
   - Redis for distributed rate limiting
   - Consistent across instances
   - Handle storage failures gracefully

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
