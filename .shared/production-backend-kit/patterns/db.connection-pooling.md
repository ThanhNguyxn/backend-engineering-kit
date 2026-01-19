---
id: db-connection-pooling
title: Database Connection Pooling
tags:
  - database
  - connection-pool
  - performance
  - postgresql
  - mysql
level: intermediate
stacks:
  - postgresql
  - mysql
  - sqlserver
scope: database
maturity: stable
version: 2.0.0
sources:
  - https://www.postgresql.org/docs/current/runtime-config-connection.html
  - https://wiki.postgresql.org/wiki/Number_Of_Database_Connections
  - https://www.pgbouncer.org/
  - https://aws.amazon.com/blogs/database/best-practices-for-amazon-rds-postgresql-connection-pooling/
---

# Database Connection Pooling

## Problem

Database connections are expensive:
- **TCP handshake** + TLS negotiation: 100-300ms
- **Authentication**: Database validates credentials
- **Memory overhead**: PostgreSQL ~10MB per connection
- **Process/thread creation**: OS resources

Without pooling:
- Connection storms during traffic spikes
- Database overwhelmed with connection management
- Slow response times waiting for connections
- "Too many connections" errors

## When to use

- **Always** for production applications
- Serverless/Lambda functions (even more critical)
- High-concurrency workloads
- Microservices with many instances
- Connection-limited database tiers

## Solution

### 1. Connection Pool Sizing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONNECTION POOL FORMULA                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Optimal Pool Size = (core_count * 2) + effective_spindle_count             │
│                                                                             │
│  For SSD/NVMe (spindle_count = 1):                                         │
│    8 cores → (8 * 2) + 1 = 17 connections                                  │
│                                                                             │
│  For most applications:                                                     │
│    Start with: pool_size = 10-20                                           │
│    Max practical limit: ~100 per application instance                       │
│                                                                             │
│  ⚠️  More connections ≠ better performance!                                │
│      Too many connections = context switching overhead                      │
│                                                                             │
│  Total DB Connections = pool_size × num_app_instances                       │
│  Example: 20 pool × 5 instances = 100 connections to database              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Application-Level Pooling (Node.js)

```typescript
import { Pool, PoolConfig } from 'pg';

const poolConfig: PoolConfig = {
  // Connection settings
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // Pool size
  min: 2,                    // Minimum connections to keep open
  max: 20,                   // Maximum connections in pool
  
  // Timeouts
  connectionTimeoutMillis: 10000,  // Time to wait for connection
  idleTimeoutMillis: 30000,        // Close idle connections after 30s
  
  // Keep-alive (important for cloud DBs with idle timeouts)
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  
  // Statement timeout (prevent runaway queries)
  statement_timeout: 30000,  // 30 seconds
  
  // SSL for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    ca: process.env.DB_CA_CERT,
  } : false,
  
  // Application name (helps identify connections in DB)
  application_name: `${process.env.SERVICE_NAME}-${process.env.HOSTNAME}`,
};

const pool = new Pool(poolConfig);

// Event handlers for monitoring
pool.on('connect', (client) => {
  metrics.increment('db.connection.created');
  logger.debug('New database connection established');
});

pool.on('acquire', (client) => {
  metrics.increment('db.connection.acquired');
});

pool.on('release', (client) => {
  metrics.increment('db.connection.released');
});

pool.on('remove', (client) => {
  metrics.increment('db.connection.removed');
});

pool.on('error', (err, client) => {
  metrics.increment('db.connection.error');
  logger.error({ err }, 'Unexpected database pool error');
});

// Expose pool metrics
function getPoolStats() {
  return {
    total: pool.totalCount,      // Total connections created
    idle: pool.idleCount,        // Connections waiting to be used
    waiting: pool.waitingCount,  // Queries waiting for connection
  };
}

// Periodic metrics collection
setInterval(() => {
  const stats = getPoolStats();
  metrics.gauge('db.pool.total', stats.total);
  metrics.gauge('db.pool.idle', stats.idle);
  metrics.gauge('db.pool.waiting', stats.waiting);
  metrics.gauge('db.pool.utilization', 
    (stats.total - stats.idle) / poolConfig.max!
  );
}, 10000);

// Graceful shutdown
async function closePool() {
  logger.info('Closing database pool...');
  await pool.end();
  logger.info('Database pool closed');
}

process.on('SIGTERM', closePool);
```

### 3. PgBouncer (External Pooler)

```ini
; /etc/pgbouncer/pgbouncer.ini

[databases]
; database = host port dbname user password
myapp = host=db.internal port=5432 dbname=myapp

[pgbouncer]
; Listen on all interfaces
listen_addr = 0.0.0.0
listen_port = 6432

; Authentication
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

; Pool mode
; - session: Connection assigned for entire session (default)
; - transaction: Connection assigned per transaction (recommended)
; - statement: Connection assigned per statement (most aggressive)
pool_mode = transaction

; Pool size
default_pool_size = 20
min_pool_size = 5
max_client_conn = 1000      ; Max client connections to PgBouncer
max_db_connections = 100     ; Max connections TO the database

; Reserve connections for admin
reserve_pool_size = 5
reserve_pool_timeout = 3

; Timeouts
server_connect_timeout = 10
server_idle_timeout = 600
server_lifetime = 3600
client_idle_timeout = 0      ; Don't timeout idle clients

; Query timeout
query_timeout = 30
query_wait_timeout = 60

; Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
stats_period = 60

; Admin access
admin_users = postgres
stats_users = monitoring
```

```yaml
# Kubernetes deployment with PgBouncer sidecar
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        # Application container
        - name: app
          image: myapp:latest
          env:
            - name: DATABASE_URL
              value: "postgresql://user:pass@localhost:6432/myapp"
        
        # PgBouncer sidecar
        - name: pgbouncer
          image: edoburu/pgbouncer:latest
          ports:
            - containerPort: 6432
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: url
            - name: POOL_MODE
              value: "transaction"
            - name: DEFAULT_POOL_SIZE
              value: "20"
            - name: MAX_CLIENT_CONN
              value: "100"
          resources:
            requests:
              memory: "64Mi"
              cpu: "100m"
            limits:
              memory: "128Mi"
              cpu: "500m"
```

### 4. Python Connection Pooling

```python
from sqlalchemy import create_engine, event, text
from sqlalchemy.pool import QueuePool
import os

# SQLAlchemy with connection pool
engine = create_engine(
    os.environ["DATABASE_URL"],
    
    # Pool class
    poolclass=QueuePool,
    
    # Pool size
    pool_size=10,           # Number of connections to keep
    max_overflow=20,        # Extra connections when pool exhausted
    pool_pre_ping=True,     # Verify connection before using
    
    # Timeouts
    pool_timeout=30,        # Wait for connection
    pool_recycle=1800,      # Recycle connections after 30 min
    
    # Connection args
    connect_args={
        "connect_timeout": 10,
        "application_name": f"{os.environ['SERVICE_NAME']}",
        "options": "-c statement_timeout=30000",
    },
)

# Connection lifecycle events
@event.listens_for(engine, "connect")
def on_connect(dbapi_connection, connection_record):
    """Called when a new connection is created"""
    metrics.increment("db.connection.created")

@event.listens_for(engine, "checkout")
def on_checkout(dbapi_connection, connection_record, connection_proxy):
    """Called when a connection is retrieved from pool"""
    metrics.increment("db.connection.checkout")

@event.listens_for(engine, "checkin")
def on_checkin(dbapi_connection, connection_record):
    """Called when a connection is returned to pool"""
    metrics.increment("db.connection.checkin")

# Monitor pool stats
def get_pool_status():
    return {
        "pool_size": engine.pool.size(),
        "checked_in": engine.pool.checkedin(),
        "checked_out": engine.pool.checkedout(),
        "overflow": engine.pool.overflow(),
        "invalid": engine.pool.invalidatedcount(),
    }

# FastAPI integration
from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session, sessionmaker

SessionLocal = sessionmaker(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI()

@app.get("/users/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    # Connection automatically returned to pool when request ends
    return db.query(User).filter(User.id == user_id).first()
```

### 5. Serverless/Lambda Considerations

```typescript
// Serverless needs external connection pooling!
// Each Lambda invocation could create a new connection

// Option 1: RDS Proxy (AWS managed)
const pool = new Pool({
  host: 'my-proxy.proxy-xxx.us-east-1.rds.amazonaws.com',
  // RDS Proxy handles pooling - use smaller pool per Lambda
  max: 2,  // Each Lambda instance only needs 1-2 connections
});

// Option 2: Neon/PlanetScale with built-in pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon pooler URL: postgres://...@ep-xxx.us-east-1.aws.neon.tech/mydb?sslmode=require
  max: 1,  // Pooler handles multiplexing
});

// Option 3: Singleton pattern for connection reuse
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      max: 2,
      connectionTimeoutMillis: 5000,
      // Important for Lambda: close idle connections quickly
      idleTimeoutMillis: 1000,
    });
  }
  return pool;
}

// Lambda handler
export async function handler(event: APIGatewayEvent) {
  const pool = getPool();  // Reuse pool across invocations
  
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users WHERE id = $1', [event.pathParameters.id]);
    return { statusCode: 200, body: JSON.stringify(result.rows[0]) };
  } finally {
    client.release();  // Return to pool, don't close
  }
}
```

### 6. Monitoring Queries

```sql
-- PostgreSQL: Active connections
SELECT 
  usename,
  application_name,
  client_addr,
  state,
  query_start,
  state_change,
  wait_event_type,
  wait_event
FROM pg_stat_activity
WHERE datname = 'mydb'
ORDER BY query_start;

-- Connections by application
SELECT 
  application_name,
  count(*) as connections,
  count(*) FILTER (WHERE state = 'idle') as idle,
  count(*) FILTER (WHERE state = 'active') as active,
  count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
FROM pg_stat_activity
WHERE datname = 'mydb'
GROUP BY application_name
ORDER BY connections DESC;

-- Connection limits
SELECT 
  max_conn,
  used,
  res_for_super,
  max_conn - used - res_for_super AS available
FROM 
  (SELECT count(*) used FROM pg_stat_activity) t1,
  (SELECT setting::int res_for_super FROM pg_settings WHERE name = 'superuser_reserved_connections') t2,
  (SELECT setting::int max_conn FROM pg_settings WHERE name = 'max_connections') t3;

-- Long-running queries
SELECT 
  pid,
  now() - query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%'
  AND now() - query_start > interval '5 minutes'
ORDER BY duration DESC;

-- Kill long-running queries
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '30 minutes'
  AND usename != 'postgres';
```

### 7. Health Check with Pool Validation

```typescript
// Health check endpoint
app.get('/health/ready', async (req, res) => {
  const checks = {
    database: { status: 'unknown', latency: 0 },
    pool: getPoolStats(),
  };
  
  try {
    const start = Date.now();
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      checks.database = {
        status: 'healthy',
        latency: Date.now() - start,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      error: error.message,
    };
  }
  
  // Check pool health
  const poolHealth = checks.pool.waiting === 0 && 
                     checks.pool.idle > 0;
  
  const isHealthy = checks.database.status === 'healthy' && poolHealth;
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    checks,
  });
});

// Circuit breaker for database
class DatabaseCircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private failureThreshold = 5,
    private resetTimeout = 30000,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Database circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      logger.error('Database circuit breaker opened');
    }
  }
}
```

### 8. Connection Pool Tuning

```typescript
// Dynamic pool sizing based on load
class AdaptivePool {
  private pool: Pool;
  private config: PoolConfig;
  
  constructor(config: PoolConfig) {
    this.config = config;
    this.pool = new Pool(config);
    this.startMonitoring();
  }

  private startMonitoring() {
    setInterval(() => {
      const stats = {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount,
      };
      
      // If queries are waiting, consider scaling up
      if (stats.waiting > 0 && stats.total < (this.config.max || 20)) {
        logger.warn({
          stats,
          message: 'Queries waiting for connections',
          suggestion: 'Consider increasing pool size or adding read replicas',
        });
      }
      
      // If pool is mostly idle, log for potential downsizing
      if (stats.idle > stats.total * 0.8) {
        logger.info({
          stats,
          message: 'Pool is mostly idle',
          suggestion: 'Consider decreasing pool size',
        });
      }
      
      metrics.gauge('db.pool.total', stats.total);
      metrics.gauge('db.pool.idle', stats.idle);
      metrics.gauge('db.pool.waiting', stats.waiting);
      metrics.gauge('db.pool.utilization', 
        stats.total > 0 ? (stats.total - stats.idle) / stats.total : 0
      );
    }, 10000);
  }
}

// Recommended settings by workload
const POOL_PRESETS = {
  // Low traffic, cost-sensitive
  small: {
    min: 1,
    max: 5,
    idleTimeoutMillis: 60000,
  },
  
  // Medium traffic, balanced
  medium: {
    min: 5,
    max: 20,
    idleTimeoutMillis: 30000,
  },
  
  // High traffic, performance-critical
  large: {
    min: 10,
    max: 50,
    idleTimeoutMillis: 10000,
  },
  
  // Serverless/Lambda
  serverless: {
    min: 0,
    max: 2,
    idleTimeoutMillis: 1000,  // Close quickly
  },
};
```

## Pitfalls

| Pitfall | Impact | How to Avoid |
|---------|--------|--------------|
| Pool too large | Database overwhelmed | Start small, monitor, increase gradually |
| Pool too small | Requests waiting, timeouts | Monitor waiting count |
| No connection timeout | Hanging requests | Set connectionTimeoutMillis |
| No statement timeout | Runaway queries | Set statement_timeout |
| Leaking connections | Pool exhaustion | Always release/close in finally block |
| No health checks | Using dead connections | Enable pool_pre_ping |
| Lambda without pooler | Connection explosion | Use RDS Proxy/PgBouncer |
| Idle in transaction | Locks held, pool blocked | Set idle_in_transaction_session_timeout |

## Checklist

- [ ] Connection pool configured in application
- [ ] Pool size based on workload, not arbitrary number
- [ ] Connection timeout set
- [ ] Statement timeout set
- [ ] Idle timeout configured
- [ ] Connection keep-alive enabled
- [ ] Pool metrics exposed (total, idle, waiting)
- [ ] Health check validates pool
- [ ] Graceful shutdown drains pool
- [ ] SSL/TLS enabled for connections
- [ ] Application name set for debugging
- [ ] External pooler (PgBouncer) for high scale
- [ ] Serverless uses managed pooler

## References

- [PostgreSQL Connection Settings](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [PgBouncer Documentation](https://www.pgbouncer.org/)
- [AWS RDS Proxy](https://aws.amazon.com/rds/proxy/)
- [HikariCP (Java) Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing)
- [node-postgres Pool](https://node-postgres.com/features/pooling)
