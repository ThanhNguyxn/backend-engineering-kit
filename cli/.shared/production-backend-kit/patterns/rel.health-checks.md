---
id: rel-health-checks
title: Health Check Endpoints
tags:
  - reliability
  - health-check
  - monitoring
  - kubernetes
  - devops
level: intermediate
stacks:
  - all
scope: reliability
maturity: stable
version: 2.0.0
sources:
  - https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
  - https://aws.amazon.com/builders-library/implementing-health-checks/
  - https://docs.microsoft.com/en-us/azure/architecture/patterns/health-endpoint-monitoring
---

# Health Check Endpoints

## Problem

Without health checks:
- Load balancers send traffic to unhealthy instances
- Container orchestrators don't know when to restart pods
- Deployments can't verify successful rollout
- Cascading failures spread undetected
- Debugging production issues becomes guesswork

## When to use

- **Always** for any production service
- Kubernetes/Docker deployments (required)
- Behind load balancers
- Microservices architectures
- Any service with external dependencies

## Solution

### 1. Three Types of Health Checks

```
┌─────────────────────────────────────────────────────────────────────┐
│ Type          │ Purpose              │ Failure Action              │
├───────────────┼──────────────────────┼─────────────────────────────┤
│ LIVENESS      │ Is the process alive?│ Restart container           │
│ /health/live  │ Can it respond?      │ Kill and recreate           │
├───────────────┼──────────────────────┼─────────────────────────────┤
│ READINESS     │ Can it serve traffic?│ Remove from load balancer   │
│ /health/ready │ Are deps available?  │ Stop sending requests       │
├───────────────┼──────────────────────┼─────────────────────────────┤
│ STARTUP       │ Has it started?      │ Wait longer before probes   │
│ /health/start │ Initialization done? │ Extend startup time         │
└─────────────────────────────────────────────────────────────────────┘

Key Insight:
- LIVENESS: "Should this be killed and restarted?"
- READINESS: "Should this receive traffic right now?"
- STARTUP: "Has this finished booting?"
```

### 2. What Each Check Should Verify

```typescript
// LIVENESS - Keep it simple!
// Only check if the process can respond
// DON'T check external dependencies here
GET /health/live
Response: { "status": "ok" }

// READINESS - Check dependencies
// Verify the service can actually serve requests
GET /health/ready
Response: {
  "status": "ok",  // or "degraded" or "unhealthy"
  "checks": {
    "database": { "status": "ok", "latency_ms": 5 },
    "cache": { "status": "ok", "latency_ms": 2 },
    "external_api": { "status": "degraded", "latency_ms": 500 }
  }
}

// STARTUP - One-time initialization
// Check if app has finished starting
GET /health/startup
Response: { "status": "ok", "started_at": "2026-01-19T12:00:00Z" }
```

### 3. Response Format

```json
// Healthy
HTTP/1.1 200 OK
{
  "status": "ok",
  "version": "1.2.3",
  "uptime_seconds": 86400,
  "checks": {
    "database": {
      "status": "ok",
      "latency_ms": 5,
      "message": "Connected to primary"
    },
    "redis": {
      "status": "ok",
      "latency_ms": 2
    }
  }
}

// Degraded (still serving, but not optimal)
HTTP/1.1 200 OK
{
  "status": "degraded",
  "checks": {
    "database": { "status": "ok" },
    "redis": { 
      "status": "degraded",
      "message": "Failover to replica"
    }
  }
}

// Unhealthy
HTTP/1.1 503 Service Unavailable
{
  "status": "unhealthy",
  "checks": {
    "database": {
      "status": "unhealthy",
      "error": "Connection refused",
      "last_check": "2026-01-19T12:00:00Z"
    }
  }
}
```

### 4. Kubernetes Configuration

```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: app
      image: myapp:1.0
      ports:
        - containerPort: 8080
      
      # STARTUP probe - runs first during boot
      startupProbe:
        httpGet:
          path: /health/startup
          port: 8080
        initialDelaySeconds: 5
        periodSeconds: 5
        failureThreshold: 30  # Allow up to 150s for startup
      
      # LIVENESS probe - runs after startup passes
      livenessProbe:
        httpGet:
          path: /health/live
          port: 8080
        initialDelaySeconds: 0
        periodSeconds: 10
        timeoutSeconds: 5
        failureThreshold: 3  # Restart after 3 failures
      
      # READINESS probe - determines if receives traffic
      readinessProbe:
        httpGet:
          path: /health/ready
          port: 8080
        initialDelaySeconds: 0
        periodSeconds: 5
        timeoutSeconds: 3
        failureThreshold: 1  # Remove immediately on failure
```

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| External deps in liveness | Restart loops when DB down | Only check process health |
| Missing readiness check | Traffic to unready instances | Always implement readiness |
| Slow health checks | Probe timeouts, false failures | Set timeout, cache results |
| No startup probe | Slow apps killed during boot | Use startup for slow init |
| Exposing sensitive info | Security risk | Don't include credentials/paths |
| Missing dependency check | Serving errors silently | Check all critical deps |
| Health check on same thread | Blocked by slow requests | Use dedicated thread/async |

## Checklist

- [ ] `/health/live` endpoint returns 200 quickly (no dep checks)
- [ ] `/health/ready` checks all critical dependencies
- [ ] `/health/startup` for slow-starting applications
- [ ] Response time under timeout threshold
- [ ] Appropriate HTTP status codes (200/503)
- [ ] Dependency checks have individual timeouts
- [ ] Health checks don't expose sensitive info
- [ ] Kubernetes/ELB probes configured correctly
- [ ] Failed checks logged with context
- [ ] Health check metrics exported
- [ ] Degraded state supported (not just ok/fail)
- [ ] Health checks are authenticated (if needed)

## Code Examples

### TypeScript/Node.js (Express)

```typescript
import { Router } from 'express';
import { Pool } from 'pg';
import Redis from 'ioredis';

interface HealthCheck {
  status: 'ok' | 'degraded' | 'unhealthy';
  latency_ms?: number;
  message?: string;
  error?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  version: string;
  uptime_seconds: number;
  checks?: Record<string, HealthCheck>;
}

const startTime = Date.now();
let isReady = false;

// Dependency health checkers
async function checkDatabase(pool: Pool): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      error: (error as Error).message,
      latency_ms: Date.now() - start 
    };
  }
}

async function checkRedis(redis: Redis): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await redis.ping();
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (error) {
    return { 
      status: 'degraded', // Redis might be optional
      error: (error as Error).message,
      latency_ms: Date.now() - start 
    };
  }
}

// Health router
export function createHealthRouter(pool: Pool, redis: Redis): Router {
  const router = Router();
  
  // LIVENESS - Simple, fast, no external calls
  router.get('/health/live', (req, res) => {
    res.json({ status: 'ok' });
  });
  
  // STARTUP - Check initialization complete
  router.get('/health/startup', (req, res) => {
    if (isReady) {
      res.json({ 
        status: 'ok',
        started_at: new Date(startTime).toISOString()
      });
    } else {
      res.status(503).json({ 
        status: 'unhealthy',
        message: 'Application still starting'
      });
    }
  });
  
  // READINESS - Check all dependencies
  router.get('/health/ready', async (req, res) => {
    const checks: Record<string, HealthCheck> = {};
    
    // Run checks in parallel with timeout
    const timeout = 3000;
    const checkPromises = [
      Promise.race([
        checkDatabase(pool),
        new Promise<HealthCheck>(resolve => 
          setTimeout(() => resolve({ status: 'unhealthy', error: 'Timeout' }), timeout)
        )
      ]).then(result => { checks.database = result; }),
      
      Promise.race([
        checkRedis(redis),
        new Promise<HealthCheck>(resolve => 
          setTimeout(() => resolve({ status: 'degraded', error: 'Timeout' }), timeout)
        )
      ]).then(result => { checks.redis = result; }),
    ];
    
    await Promise.all(checkPromises);
    
    // Determine overall status
    const hasUnhealthy = Object.values(checks).some(c => c.status === 'unhealthy');
    const hasDegraded = Object.values(checks).some(c => c.status === 'degraded');
    
    const response: HealthResponse = {
      status: hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'ok',
      version: process.env.APP_VERSION || '1.0.0',
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      checks,
    };
    
    res.status(hasUnhealthy ? 503 : 200).json(response);
  });
  
  return router;
}

// Mark as ready after initialization
export function markReady(): void {
  isReady = true;
}

// Usage
app.use(createHealthRouter(pgPool, redisClient));

// After all initialization is done
Promise.all([
  runMigrations(),
  warmUpCaches(),
]).then(() => {
  markReady();
  console.log('Application ready');
});
```

### Python/FastAPI

```python
from fastapi import FastAPI, Response
from datetime import datetime, timezone
from typing import Dict, Optional, Literal
from pydantic import BaseModel
import asyncio
import time

app = FastAPI()
start_time = time.time()
is_ready = False

class HealthCheck(BaseModel):
    status: Literal['ok', 'degraded', 'unhealthy']
    latency_ms: Optional[float] = None
    message: Optional[str] = None
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: Literal['ok', 'degraded', 'unhealthy']
    version: str = "1.0.0"
    uptime_seconds: int
    checks: Optional[Dict[str, HealthCheck]] = None

async def check_database() -> HealthCheck:
    start = time.time()
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("SELECT 1")
        return HealthCheck(
            status='ok',
            latency_ms=(time.time() - start) * 1000
        )
    except Exception as e:
        return HealthCheck(
            status='unhealthy',
            error=str(e),
            latency_ms=(time.time() - start) * 1000
        )

async def check_redis() -> HealthCheck:
    start = time.time()
    try:
        await redis.ping()
        return HealthCheck(
            status='ok',
            latency_ms=(time.time() - start) * 1000
        )
    except Exception as e:
        return HealthCheck(
            status='degraded',  # Redis might be optional
            error=str(e),
            latency_ms=(time.time() - start) * 1000
        )

@app.get("/health/live")
async def liveness():
    """Liveness probe - just check if process responds"""
    return {"status": "ok"}

@app.get("/health/startup")
async def startup(response: Response):
    """Startup probe - check if app finished initializing"""
    if is_ready:
        return {
            "status": "ok",
            "started_at": datetime.fromtimestamp(start_time, tz=timezone.utc).isoformat()
        }
    response.status_code = 503
    return {"status": "unhealthy", "message": "Application still starting"}

@app.get("/health/ready", response_model=HealthResponse)
async def readiness(response: Response):
    """Readiness probe - check all dependencies"""
    
    # Run checks in parallel with timeout
    async def check_with_timeout(coro, timeout=3.0, default_status='unhealthy'):
        try:
            return await asyncio.wait_for(coro, timeout=timeout)
        except asyncio.TimeoutError:
            return HealthCheck(status=default_status, error='Timeout')
    
    db_check, redis_check = await asyncio.gather(
        check_with_timeout(check_database()),
        check_with_timeout(check_redis(), default_status='degraded'),
    )
    
    checks = {
        "database": db_check,
        "redis": redis_check,
    }
    
    # Determine overall status
    statuses = [c.status for c in checks.values()]
    if 'unhealthy' in statuses:
        overall_status = 'unhealthy'
        response.status_code = 503
    elif 'degraded' in statuses:
        overall_status = 'degraded'
    else:
        overall_status = 'ok'
    
    return HealthResponse(
        status=overall_status,
        uptime_seconds=int(time.time() - start_time),
        checks=checks
    )

def mark_ready():
    global is_ready
    is_ready = True

# Startup event
@app.on_event("startup")
async def on_startup():
    await run_migrations()
    await warm_caches()
    mark_ready()
```

### Go

```go
package health

import (
    "context"
    "encoding/json"
    "net/http"
    "sync"
    "time"
)

type Status string

const (
    StatusOK        Status = "ok"
    StatusDegraded  Status = "degraded"
    StatusUnhealthy Status = "unhealthy"
)

type Check struct {
    Status    Status  `json:"status"`
    LatencyMs float64 `json:"latency_ms,omitempty"`
    Message   string  `json:"message,omitempty"`
    Error     string  `json:"error,omitempty"`
}

type Response struct {
    Status        Status           `json:"status"`
    Version       string           `json:"version"`
    UptimeSeconds int64            `json:"uptime_seconds"`
    Checks        map[string]Check `json:"checks,omitempty"`
}

type Checker func(ctx context.Context) Check

type HealthHandler struct {
    startTime time.Time
    isReady   bool
    mu        sync.RWMutex
    checkers  map[string]Checker
    version   string
}

func NewHealthHandler(version string) *HealthHandler {
    return &HealthHandler{
        startTime: time.Now(),
        checkers:  make(map[string]Checker),
        version:   version,
    }
}

func (h *HealthHandler) AddChecker(name string, checker Checker) {
    h.checkers[name] = checker
}

func (h *HealthHandler) SetReady(ready bool) {
    h.mu.Lock()
    defer h.mu.Unlock()
    h.isReady = ready
}

func (h *HealthHandler) LivenessHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *HealthHandler) StartupHandler(w http.ResponseWriter, r *http.Request) {
    h.mu.RLock()
    ready := h.isReady
    h.mu.RUnlock()

    w.Header().Set("Content-Type", "application/json")
    if ready {
        json.NewEncoder(w).Encode(map[string]interface{}{
            "status":     "ok",
            "started_at": h.startTime.Format(time.RFC3339),
        })
    } else {
        w.WriteHeader(http.StatusServiceUnavailable)
        json.NewEncoder(w).Encode(map[string]string{
            "status":  "unhealthy",
            "message": "Application still starting",
        })
    }
}

func (h *HealthHandler) ReadinessHandler(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
    defer cancel()

    checks := make(map[string]Check)
    var wg sync.WaitGroup
    var mu sync.Mutex

    for name, checker := range h.checkers {
        wg.Add(1)
        go func(name string, checker Checker) {
            defer wg.Done()
            check := checker(ctx)
            mu.Lock()
            checks[name] = check
            mu.Unlock()
        }(name, checker)
    }
    wg.Wait()

    // Determine overall status
    overallStatus := StatusOK
    for _, check := range checks {
        if check.Status == StatusUnhealthy {
            overallStatus = StatusUnhealthy
            break
        }
        if check.Status == StatusDegraded {
            overallStatus = StatusDegraded
        }
    }

    response := Response{
        Status:        overallStatus,
        Version:       h.version,
        UptimeSeconds: int64(time.Since(h.startTime).Seconds()),
        Checks:        checks,
    }

    w.Header().Set("Content-Type", "application/json")
    if overallStatus == StatusUnhealthy {
        w.WriteHeader(http.StatusServiceUnavailable)
    }
    json.NewEncoder(w).Encode(response)
}

// Database checker example
func DatabaseChecker(db *sql.DB) Checker {
    return func(ctx context.Context) Check {
        start := time.Now()
        err := db.PingContext(ctx)
        latency := float64(time.Since(start).Milliseconds())
        
        if err != nil {
            return Check{
                Status:    StatusUnhealthy,
                LatencyMs: latency,
                Error:     err.Error(),
            }
        }
        return Check{Status: StatusOK, LatencyMs: latency}
    }
}

// Usage
func main() {
    health := NewHealthHandler("1.0.0")
    health.AddChecker("database", DatabaseChecker(db))
    health.AddChecker("redis", RedisChecker(redis))
    
    http.HandleFunc("/health/live", health.LivenessHandler)
    http.HandleFunc("/health/startup", health.StartupHandler)
    http.HandleFunc("/health/ready", health.ReadinessHandler)
    
    // After initialization
    go func() {
        runMigrations()
        warmCaches()
        health.SetReady(true)
    }()
    
    http.ListenAndServe(":8080", nil)
}
```

## References

- [Kubernetes - Configure Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [AWS - Implementing Health Checks](https://aws.amazon.com/builders-library/implementing-health-checks/)
- [Microsoft - Health Endpoint Monitoring Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/health-endpoint-monitoring)
- [Google SRE - Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)
