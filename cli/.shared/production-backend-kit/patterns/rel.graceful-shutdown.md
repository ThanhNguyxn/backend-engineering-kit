---
id: rel-graceful-shutdown
title: Graceful Shutdown
tags:
  - reliability
  - shutdown
  - kubernetes
  - devops
  - deployment
level: intermediate
stacks:
  - all
scope: reliability
maturity: stable
version: 2.0.0
sources:
  - https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination
  - https://aws.amazon.com/builders-library/avoiding-overload-in-distributed-systems/
  - https://blog.risingstack.com/graceful-shutdown-node-js-kubernetes/
---

# Graceful Shutdown

## Problem

Abrupt process termination causes:
- In-flight requests dropped (500 errors for users)
- Database transactions left incomplete
- Message queue messages lost
- WebSocket connections cut without notice
- Resource leaks (file handles, connections)
- Data corruption in write operations

## When to use

- **Every production service** - no exceptions
- Kubernetes deployments (required for zero-downtime)
- Any service handling stateful requests
- Background job processors
- WebSocket/long-polling servers
- Services with database transactions

## Solution

### 1. Shutdown Sequence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GRACEFUL SHUTDOWN SEQUENCE                               │
└─────────────────────────────────────────────────────────────────────────────┘

   SIGTERM received
         │
         ▼
   ┌─────────────────┐
   │ 1. STOP ACCEPTING│   Stop receiving new requests
   │    NEW REQUESTS  │   Return 503 for new connections
   └────────┬────────┘   Unregister from service discovery
            │
            ▼
   ┌─────────────────┐
   │ 2. WAIT FOR     │   Let in-flight requests complete
   │    IN-FLIGHT    │   Drain connection pools
   └────────┬────────┘   Configurable timeout (15-30s)
            │
            ▼
   ┌─────────────────┐
   │ 3. CLOSE        │   Close database connections
   │    CONNECTIONS  │   Close Redis/cache connections
   └────────┬────────┘   Close message queue connections
            │
            ▼
   ┌─────────────────┐
   │ 4. FLUSH &      │   Flush logs to disk
   │    CLEANUP      │   Flush metrics
   └────────┬────────┘   Release file handles
            │
            ▼
   ┌─────────────────┐
   │ 5. EXIT         │   Exit with code 0 (success)
   └─────────────────┘


Timeline:
0s          15s         30s
│───────────│───────────│
│ Draining  │ Force     │
│ requests  │ shutdown  │
│           │ (SIGKILL) │
```

### 2. Kubernetes Lifecycle

```yaml
apiVersion: v1
kind: Pod
spec:
  # Time between SIGTERM and SIGKILL
  terminationGracePeriodSeconds: 30
  
  containers:
    - name: app
      lifecycle:
        preStop:
          exec:
            # Give load balancer time to remove pod from pool
            command: ["sleep", "5"]
```

```
Pod Termination Timeline:
─────────────────────────────────────────────────────────────────────
0s       5s                                    25s       30s
│        │                                      │         │
│ preStop│        Application shutdown          │ Timeout │
│ hook   │        (handle SIGTERM)              │         │
│        │                                      │         │
│        │◀─────── Your shutdown window ───────▶│         │
│        │                                      │         │
│ LB removes pod from endpoints                 │ SIGKILL │
─────────────────────────────────────────────────────────────────────
```

### 3. Signal Handling

| Signal | Default Action | Graceful Action |
|--------|---------------|-----------------|
| `SIGTERM` | Terminate | Begin graceful shutdown |
| `SIGINT` | Terminate | Begin graceful shutdown |
| `SIGQUIT` | Core dump | Graceful shutdown + dump |
| `SIGKILL` | Immediate kill | Cannot be caught! |
| `SIGHUP` | Terminate | Reload configuration |

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| Not handling SIGTERM | Requests dropped on deploy | Always register signal handlers |
| Too short grace period | Requests still dropped | Set appropriate timeout (15-30s) |
| No preStop hook in K8s | Traffic during shutdown | Add sleep in preStop |
| Infinite shutdown wait | Pod never terminates | Set hard timeout |
| Not draining connections | Active connections dropped | Wait for in-flight requests |
| Force-killing DB transactions | Data corruption | Await pending transactions |
| Not closing message consumers | Lost messages | Stop consuming before exit |

## Checklist

- [ ] SIGTERM handler registered
- [ ] SIGINT handler for local dev
- [ ] Stop accepting new requests on shutdown
- [ ] Wait for in-flight requests (with timeout)
- [ ] Close database connection pools
- [ ] Close cache connections (Redis)
- [ ] Stop message queue consumers
- [ ] Flush logs before exit
- [ ] Kubernetes `terminationGracePeriodSeconds` set
- [ ] preStop hook for load balancer sync
- [ ] Health check returns 503 during shutdown
- [ ] Hard timeout prevents infinite hang
- [ ] Exit with code 0 on clean shutdown

## Code Examples

### TypeScript/Node.js (Express)

```typescript
import express from 'express';
import { Server } from 'http';
import { Pool } from 'pg';

class GracefulShutdown {
  private isShuttingDown = false;
  private server: Server | null = null;
  private connections = new Set<any>();
  private shutdownTimeout = 30000; // 30 seconds
  
  constructor(
    private app: express.Application,
    private db: Pool,
    private redis: any,
  ) {}
  
  start(port: number): Server {
    this.server = this.app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
    
    // Track connections for forced cleanup
    this.server.on('connection', (conn) => {
      this.connections.add(conn);
      conn.on('close', () => this.connections.delete(conn));
    });
    
    // Register signal handlers
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    
    // Middleware to reject requests during shutdown
    this.app.use((req, res, next) => {
      if (this.isShuttingDown) {
        res.status(503).json({
          error: 'Service is shutting down',
          retryAfter: 5,
        });
        return;
      }
      next();
    });
    
    return this.server;
  }
  
  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      console.log('Shutdown already in progress');
      return;
    }
    
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    this.isShuttingDown = true;
    
    // Set hard timeout
    const forceShutdownTimer = setTimeout(() => {
      console.error('Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, this.shutdownTimeout);
    
    try {
      // 1. Stop accepting new connections
      await this.closeServer();
      console.log('✓ Server closed to new connections');
      
      // 2. Wait for existing requests to complete
      await this.drainConnections();
      console.log('✓ Active connections drained');
      
      // 3. Close database pool
      await this.db.end();
      console.log('✓ Database connections closed');
      
      // 4. Close Redis
      await this.redis.quit();
      console.log('✓ Redis connection closed');
      
      // 5. Flush logs
      await this.flushLogs();
      console.log('✓ Logs flushed');
      
      clearTimeout(forceShutdownTimer);
      console.log('Graceful shutdown complete');
      process.exit(0);
      
    } catch (error) {
      console.error('Error during shutdown:', error);
      clearTimeout(forceShutdownTimer);
      process.exit(1);
    }
  }
  
  private closeServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      
      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  
  private drainConnections(): Promise<void> {
    return new Promise((resolve) => {
      // Give connections time to finish
      const checkInterval = setInterval(() => {
        if (this.connections.size === 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // Set max drain time
      setTimeout(() => {
        clearInterval(checkInterval);
        // Force close remaining connections
        for (const conn of this.connections) {
          conn.destroy();
        }
        this.connections.clear();
        resolve();
      }, 10000); // 10s max drain time
    });
  }
  
  private async flushLogs(): Promise<void> {
    // If using async logging, ensure buffers are flushed
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Usage
const app = express();
const db = new Pool({ /* config */ });
const redis = new Redis({ /* config */ });

const graceful = new GracefulShutdown(app, db, redis);

// Add routes
app.get('/health/live', (req, res) => res.json({ status: 'ok' }));
app.get('/health/ready', (req, res) => {
  if (graceful.isShuttingDown) {
    return res.status(503).json({ status: 'shutting_down' });
  }
  res.json({ status: 'ok' });
});

graceful.start(3000);
```

### Python/FastAPI (with uvicorn)

```python
import asyncio
import signal
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from typing import Set
import logging

logger = logging.getLogger(__name__)

class ShutdownManager:
    def __init__(self):
        self.is_shutting_down = False
        self.active_requests: Set[int] = set()
        self._request_counter = 0
        
    def start_request(self) -> int:
        self._request_counter += 1
        request_id = self._request_counter
        self.active_requests.add(request_id)
        return request_id
    
    def end_request(self, request_id: int):
        self.active_requests.discard(request_id)
    
    async def wait_for_requests(self, timeout: float = 10.0):
        """Wait for active requests to complete"""
        start = asyncio.get_event_loop().time()
        while self.active_requests:
            if asyncio.get_event_loop().time() - start > timeout:
                logger.warning(f"Timeout waiting for {len(self.active_requests)} requests")
                break
            await asyncio.sleep(0.1)

shutdown_manager = ShutdownManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting application")
    await db.connect()
    await redis.connect()
    
    yield  # Application runs here
    
    # Shutdown
    logger.info("Starting graceful shutdown")
    shutdown_manager.is_shutting_down = True
    
    # Wait for in-flight requests
    await shutdown_manager.wait_for_requests(timeout=15.0)
    logger.info("✓ Active requests drained")
    
    # Close connections
    await db.disconnect()
    logger.info("✓ Database disconnected")
    
    await redis.close()
    logger.info("✓ Redis disconnected")
    
    logger.info("Graceful shutdown complete")

app = FastAPI(lifespan=lifespan)

@app.middleware("http")
async def track_requests(request: Request, call_next):
    # Reject new requests during shutdown
    if shutdown_manager.is_shutting_down:
        return Response(
            content='{"error": "Service shutting down"}',
            status_code=503,
            media_type="application/json",
            headers={"Retry-After": "5"}
        )
    
    request_id = shutdown_manager.start_request()
    try:
        response = await call_next(request)
        return response
    finally:
        shutdown_manager.end_request(request_id)

@app.get("/health/ready")
async def readiness():
    if shutdown_manager.is_shutting_down:
        return Response(status_code=503, content='{"status": "shutting_down"}')
    return {"status": "ok"}

# For running with uvicorn
if __name__ == "__main__":
    import uvicorn
    
    config = uvicorn.Config(
        app=app,
        host="0.0.0.0",
        port=8000,
        # Graceful shutdown timeout
        timeout_graceful_shutdown=30,
    )
    server = uvicorn.Server(config)
    
    # Handle signals
    loop = asyncio.get_event_loop()
    
    def handle_signal(sig):
        logger.info(f"Received {sig.name}")
        loop.create_task(server.shutdown())
    
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, handle_signal, sig)
    
    loop.run_until_complete(server.serve())
```

### Go

```go
package main

import (
    "context"
    "log"
    "net/http"
    "os"
    "os/signal"
    "sync"
    "sync/atomic"
    "syscall"
    "time"
)

type Server struct {
    httpServer      *http.Server
    isShuttingDown  atomic.Bool
    activeRequests  sync.WaitGroup
    db              *sql.DB
    redis           *redis.Client
}

func NewServer(addr string, db *sql.DB, redis *redis.Client) *Server {
    s := &Server{
        db:    db,
        redis: redis,
    }
    
    mux := http.NewServeMux()
    
    // Health endpoints
    mux.HandleFunc("/health/live", func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte(`{"status":"ok"}`))
    })
    
    mux.HandleFunc("/health/ready", func(w http.ResponseWriter, r *http.Request) {
        if s.isShuttingDown.Load() {
            w.WriteHeader(http.StatusServiceUnavailable)
            w.Write([]byte(`{"status":"shutting_down"}`))
            return
        }
        w.Write([]byte(`{"status":"ok"}`))
    })
    
    // Wrap handler to track requests
    handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if s.isShuttingDown.Load() {
            w.Header().Set("Retry-After", "5")
            http.Error(w, `{"error":"Service shutting down"}`, http.StatusServiceUnavailable)
            return
        }
        
        s.activeRequests.Add(1)
        defer s.activeRequests.Done()
        
        mux.ServeHTTP(w, r)
    })
    
    s.httpServer = &http.Server{
        Addr:    addr,
        Handler: handler,
    }
    
    return s
}

func (s *Server) Start() error {
    // Channel for shutdown signals
    stop := make(chan os.Signal, 1)
    signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)
    
    // Start server in goroutine
    go func() {
        log.Printf("Server starting on %s", s.httpServer.Addr)
        if err := s.httpServer.ListenAndServe(); err != http.ErrServerClosed {
            log.Fatalf("Server error: %v", err)
        }
    }()
    
    // Wait for shutdown signal
    sig := <-stop
    log.Printf("Received %v signal. Starting graceful shutdown...", sig)
    
    return s.Shutdown()
}

func (s *Server) Shutdown() error {
    s.isShuttingDown.Store(true)
    
    // Create context with timeout
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    
    // 1. Stop accepting new connections
    if err := s.httpServer.Shutdown(ctx); err != nil {
        log.Printf("HTTP server shutdown error: %v", err)
    }
    log.Println("✓ Server closed to new connections")
    
    // 2. Wait for active requests to complete
    done := make(chan struct{})
    go func() {
        s.activeRequests.Wait()
        close(done)
    }()
    
    select {
    case <-done:
        log.Println("✓ Active requests drained")
    case <-ctx.Done():
        log.Println("⚠ Timeout waiting for active requests")
    }
    
    // 3. Close database
    if err := s.db.Close(); err != nil {
        log.Printf("Database close error: %v", err)
    }
    log.Println("✓ Database connection closed")
    
    // 4. Close Redis
    if err := s.redis.Close(); err != nil {
        log.Printf("Redis close error: %v", err)
    }
    log.Println("✓ Redis connection closed")
    
    log.Println("Graceful shutdown complete")
    return nil
}

func main() {
    db, _ := sql.Open("postgres", os.Getenv("DATABASE_URL"))
    redis := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
    
    server := NewServer(":8080", db, redis)
    if err := server.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## References

- [Kubernetes - Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination)
- [AWS - Avoiding Overload in Distributed Systems](https://aws.amazon.com/builders-library/avoiding-overload-in-distributed-systems/)
- [Node.js Graceful Shutdown in Kubernetes](https://blog.risingstack.com/graceful-shutdown-node-js-kubernetes/)
- [Go - Graceful HTTP Server Shutdown](https://pkg.go.dev/net/http#Server.Shutdown)
