---
id: rel-caching-strategies
title: Caching Strategies & Patterns
tags:
  - reliability
  - caching
  - performance
  - redis
  - distributed-systems
level: intermediate
stacks:
  - all
scope: reliability
maturity: stable
version: 2.0.0
sources:
  - https://aws.amazon.com/caching/best-practices/
  - https://docs.microsoft.com/en-us/azure/architecture/patterns/cache-aside
  - https://redis.io/docs/manual/patterns/
  - https://martinfowler.com/bliki/TwoHardThings.html
---

# Caching Strategies & Patterns

## Problem

Without proper caching:
- Database overwhelmed with repeated identical queries
- High latency for frequently accessed data
- Unnecessary computation repeated
- Poor user experience during traffic spikes
- Higher infrastructure costs

But caching done wrong causes:
- Stale data served to users
- Cache stampedes crushing backend
- Memory bloat from unbounded caches
- Inconsistency between cache and source of truth

## When to use

- Read-heavy workloads (read:write ratio > 10:1)
- Data that changes infrequently
- Expensive computations (aggregations, ML inference)
- External API responses
- Session data and user preferences
- Database query results
- Static assets and configurations

## Solution

### 1. Caching Patterns Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Pattern          │ Description              │ Best For                      │
├──────────────────┼──────────────────────────┼───────────────────────────────┤
│ Cache-Aside      │ App manages cache        │ General purpose, most common  │
│ (Lazy Loading)   │ Load on miss             │ Read-heavy, tolerance to stale│
├──────────────────┼──────────────────────────┼───────────────────────────────┤
│ Read-Through     │ Cache loads from DB      │ Simpler app code              │
│                  │ transparently            │ Cache library handles loading │
├──────────────────┼──────────────────────────┼───────────────────────────────┤
│ Write-Through    │ Write to cache + DB      │ Strong consistency needed     │
│                  │ synchronously            │ Can't tolerate stale data     │
├──────────────────┼──────────────────────────┼───────────────────────────────┤
│ Write-Behind     │ Write to cache, async    │ High write throughput         │
│ (Write-Back)     │ persist to DB            │ Can tolerate some data loss   │
├──────────────────┼──────────────────────────┼───────────────────────────────┤
│ Refresh-Ahead    │ Proactively refresh      │ Predictable access patterns   │
│                  │ before expiry            │ Zero-latency cache hits       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Cache-Aside Pattern (Most Common)

```typescript
// The application is responsible for cache management
class UserService {
  constructor(
    private cache: Redis,
    private db: Database
  ) {}

  async getUser(id: string): Promise<User | null> {
    const cacheKey = `user:${id}`;
    
    // 1. Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      metrics.increment('cache.hit', { entity: 'user' });
      return JSON.parse(cached);
    }
    
    // 2. Cache miss - load from DB
    metrics.increment('cache.miss', { entity: 'user' });
    const user = await this.db.users.findById(id);
    
    if (user) {
      // 3. Populate cache for next time
      await this.cache.setex(
        cacheKey,
        3600, // TTL: 1 hour
        JSON.stringify(user)
      );
    }
    
    return user;
  }

  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    // 1. Update database
    const user = await this.db.users.update(id, data);
    
    // 2. Invalidate cache (not update - simpler, safer)
    await this.cache.del(`user:${id}`);
    
    // 3. Also invalidate related caches
    await this.cache.del(`user:${user.email}`);
    await this.cache.del(`team:${user.teamId}:members`);
    
    return user;
  }
}
```

### 3. Cache Key Design

```typescript
// Good cache key patterns
const CACHE_KEYS = {
  // Entity by ID
  user: (id: string) => `user:${id}`,
  
  // Entity by unique field
  userByEmail: (email: string) => `user:email:${email.toLowerCase()}`,
  
  // Collection with pagination
  userList: (page: number, limit: number) => `users:list:p${page}:l${limit}`,
  
  // Filtered collection (hash the filters)
  userSearch: (filters: object) => `users:search:${hashFilters(filters)}`,
  
  // Tenant-scoped
  tenantUser: (tenantId: string, userId: string) => `t:${tenantId}:user:${userId}`,
  
  // Versioned (for cache busting)
  config: (version: string) => `config:v${version}`,
  
  // Time-bucketed (for analytics)
  dailyStats: (date: string) => `stats:daily:${date}`,
};

// Hash filters for consistent keys
function hashFilters(filters: object): string {
  const sorted = Object.keys(filters).sort().reduce((acc, key) => {
    acc[key] = filters[key];
    return acc;
  }, {});
  return crypto.createHash('md5').update(JSON.stringify(sorted)).digest('hex').slice(0, 8);
}
```

### 4. TTL Strategies

```typescript
const TTL = {
  // Static/rarely changing
  CONFIG: 24 * 60 * 60,        // 24 hours
  FEATURE_FLAGS: 5 * 60,       // 5 minutes
  
  // User data
  USER_PROFILE: 60 * 60,       // 1 hour
  USER_SESSION: 30 * 60,       // 30 minutes
  USER_PERMISSIONS: 5 * 60,    // 5 minutes (security-sensitive)
  
  // Dynamic data
  PRODUCT_DETAILS: 15 * 60,    // 15 minutes
  INVENTORY_COUNT: 60,         // 1 minute (frequently changing)
  PRICE: 5 * 60,               // 5 minutes
  
  // Computed/expensive
  ANALYTICS_REPORT: 60 * 60,   // 1 hour
  SEARCH_RESULTS: 5 * 60,      // 5 minutes
  
  // External API
  EXCHANGE_RATES: 60 * 60,     // 1 hour
  WEATHER_DATA: 10 * 60,       // 10 minutes
};

// Add jitter to prevent thundering herd
function ttlWithJitter(baseTtl: number, jitterPercent = 10): number {
  const jitter = baseTtl * (jitterPercent / 100);
  return Math.floor(baseTtl + (Math.random() * jitter * 2) - jitter);
}
```

### 5. Cache Stampede Prevention

```typescript
// Problem: 1000 requests hit expired cache simultaneously
// All 1000 go to database = stampede

// Solution 1: Probabilistic Early Expiration (PER)
async function getWithPER<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number,
  beta = 1 // Higher = more aggressive early recompute
): Promise<T> {
  const cached = await cache.get(key);
  
  if (cached) {
    const { value, delta, expiry } = JSON.parse(cached);
    const now = Date.now();
    
    // Probabilistically recompute before expiry
    // xfetch algorithm: expiry - delta * beta * log(random())
    const shouldRecompute = now - (delta * beta * Math.log(Math.random())) >= expiry;
    
    if (!shouldRecompute) {
      return value;
    }
  }
  
  // Recompute
  const start = Date.now();
  const value = await fetchFn();
  const delta = Date.now() - start;
  
  await cache.setex(key, ttl, JSON.stringify({
    value,
    delta,
    expiry: Date.now() + (ttl * 1000),
  }));
  
  return value;
}

// Solution 2: Distributed Lock
async function getWithLock<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number
): Promise<T> {
  const cached = await cache.get(key);
  if (cached) return JSON.parse(cached);
  
  const lockKey = `lock:${key}`;
  const lockAcquired = await cache.set(lockKey, '1', 'EX', 10, 'NX');
  
  if (lockAcquired) {
    try {
      // We got the lock - fetch and cache
      const value = await fetchFn();
      await cache.setex(key, ttl, JSON.stringify(value));
      return value;
    } finally {
      await cache.del(lockKey);
    }
  } else {
    // Someone else is fetching - wait and retry
    await sleep(100);
    return getWithLock(key, fetchFn, ttl);
  }
}

// Solution 3: Stale-While-Revalidate
async function getWithSWR<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number,
  staleTtl: number // How long stale data is acceptable
): Promise<T> {
  const cached = await cache.get(key);
  
  if (cached) {
    const { value, cachedAt } = JSON.parse(cached);
    const age = Date.now() - cachedAt;
    
    if (age < ttl * 1000) {
      // Fresh - return immediately
      return value;
    }
    
    if (age < (ttl + staleTtl) * 1000) {
      // Stale but acceptable - return stale, refresh in background
      refreshInBackground(key, fetchFn, ttl); // Don't await!
      return value;
    }
  }
  
  // Expired or missing - must fetch
  return fetchAndCache(key, fetchFn, ttl);
}
```

### 6. Cache Invalidation Strategies

```typescript
// Strategy 1: Event-Driven Invalidation
class CacheInvalidationService {
  constructor(private cache: Redis, private events: EventEmitter) {
    // Listen to domain events
    events.on('user.updated', this.onUserUpdated.bind(this));
    events.on('user.deleted', this.onUserDeleted.bind(this));
    events.on('order.created', this.onOrderCreated.bind(this));
  }

  private async onUserUpdated(event: UserUpdatedEvent) {
    const keys = [
      `user:${event.userId}`,
      `user:email:${event.oldEmail}`,
      `user:email:${event.newEmail}`,
    ];
    
    // Invalidate all related keys
    await this.cache.del(...keys);
    
    // Invalidate patterns (use scan for large datasets)
    await this.invalidatePattern(`user:${event.userId}:*`);
  }

  private async invalidatePattern(pattern: string) {
    let cursor = '0';
    do {
      const [newCursor, keys] = await this.cache.scan(
        cursor, 'MATCH', pattern, 'COUNT', 100
      );
      cursor = newCursor;
      if (keys.length > 0) {
        await this.cache.del(...keys);
      }
    } while (cursor !== '0');
  }
}

// Strategy 2: Tag-Based Invalidation
class TaggedCache {
  async set(key: string, value: any, ttl: number, tags: string[]) {
    const multi = this.cache.multi();
    
    // Store value
    multi.setex(key, ttl, JSON.stringify(value));
    
    // Add key to tag sets
    for (const tag of tags) {
      multi.sadd(`tag:${tag}`, key);
      multi.expire(`tag:${tag}`, ttl + 3600); // Tag lives longer than content
    }
    
    await multi.exec();
  }

  async invalidateTag(tag: string) {
    const keys = await this.cache.smembers(`tag:${tag}`);
    if (keys.length > 0) {
      await this.cache.del(...keys, `tag:${tag}`);
    }
  }
}

// Usage
await taggedCache.set('user:123', userData, 3600, ['users', 'team:456']);
await taggedCache.set('user:124', userData, 3600, ['users', 'team:456']);

// Invalidate all users in team 456
await taggedCache.invalidateTag('team:456');
```

### 7. Multi-Layer Caching

```typescript
// L1: In-memory (fastest, smallest)
// L2: Redis (fast, shared across instances)
// L3: Database (slow, source of truth)

class MultiLayerCache<T> {
  private l1: LRUCache<string, T>;
  private l2: Redis;
  
  constructor(l1MaxSize = 1000) {
    this.l1 = new LRUCache({ max: l1MaxSize, ttl: 60 * 1000 }); // 1 min L1
  }

  async get(key: string, fetchFn: () => Promise<T>, ttl: number): Promise<T> {
    // L1: Check in-memory
    const l1Value = this.l1.get(key);
    if (l1Value !== undefined) {
      metrics.increment('cache.hit.l1');
      return l1Value;
    }

    // L2: Check Redis
    const l2Value = await this.l2.get(key);
    if (l2Value) {
      metrics.increment('cache.hit.l2');
      const parsed = JSON.parse(l2Value);
      this.l1.set(key, parsed); // Populate L1
      return parsed;
    }

    // L3: Fetch from source
    metrics.increment('cache.miss');
    const value = await fetchFn();
    
    // Populate both layers
    this.l1.set(key, value);
    await this.l2.setex(key, ttl, JSON.stringify(value));
    
    return value;
  }

  async invalidate(key: string) {
    this.l1.delete(key);
    await this.l2.del(key);
    
    // Broadcast to other instances
    await this.l2.publish('cache:invalidate', key);
  }
}
```

### 8. Cache Warming

```typescript
// Pre-populate cache on startup or schedule
class CacheWarmer {
  async warmOnStartup() {
    logger.info('Starting cache warm-up...');
    
    // Warm frequently accessed data
    await Promise.all([
      this.warmFeatureFlags(),
      this.warmPopularProducts(),
      this.warmActiveUsers(),
    ]);
    
    logger.info('Cache warm-up complete');
  }

  private async warmFeatureFlags() {
    const flags = await this.db.featureFlags.findAll({ active: true });
    
    const multi = this.cache.multi();
    for (const flag of flags) {
      multi.setex(`feature:${flag.key}`, TTL.FEATURE_FLAGS, JSON.stringify(flag));
    }
    await multi.exec();
    
    logger.info(`Warmed ${flags.length} feature flags`);
  }

  private async warmPopularProducts() {
    // Top 100 most viewed products
    const products = await this.db.products.findMany({
      orderBy: { viewCount: 'desc' },
      take: 100,
    });
    
    for (const product of products) {
      await this.cache.setex(
        `product:${product.id}`,
        TTL.PRODUCT_DETAILS,
        JSON.stringify(product)
      );
    }
  }

  // Scheduled warming - run before cache expires
  @Cron('*/5 * * * *') // Every 5 minutes
  async warmScheduled() {
    await this.warmFeatureFlags();
  }
}
```

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| Cache stampede | Database overwhelmed | Use locks, PER, or stale-while-revalidate |
| No TTL set | Memory bloat, stale forever | Always set TTL, use maxmemory policy |
| Caching nulls | Repeated DB lookups for missing data | Cache negative results with short TTL |
| Cache key collisions | Wrong data served | Include version/tenant in keys |
| Over-caching | Memory waste, stale data | Cache only hot data, measure hit rate |
| Inconsistent invalidation | Stale data after updates | Use event-driven invalidation |
| Single cache instance | SPOF, no HA | Use Redis Cluster or Sentinel |
| Caching sensitive data | Security risk | Encrypt or avoid caching PII |

## Checklist

- [ ] Caching strategy chosen (cache-aside, write-through, etc.)
- [ ] TTLs defined for each data type
- [ ] Cache key naming convention documented
- [ ] Stampede prevention implemented
- [ ] Invalidation strategy defined
- [ ] Cache hit/miss metrics tracked
- [ ] Memory limits configured (maxmemory + policy)
- [ ] Cache warming for critical data
- [ ] Null/empty results handled
- [ ] Multi-tenant isolation in cache keys
- [ ] Cache failure graceful degradation
- [ ] Sensitive data encryption or exclusion
- [ ] Redis Cluster/Sentinel for HA

## References

- [AWS ElastiCache Best Practices](https://aws.amazon.com/caching/best-practices/)
- [Redis Patterns](https://redis.io/docs/manual/patterns/)
- [Azure Cache-Aside Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/cache-aside)
- [XFetch Algorithm Paper](https://cseweb.ucsd.edu/~avattani/papers/cache_stampede.pdf)
