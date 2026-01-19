---
title: "Backend Engineering Patterns & Best Practices"
description: "> A comprehensive guide to backend engineering best practices, patterns, and production readiness checklists compiled from authoritative sources including Zalan"
generated: true
---

<!-- AUTO-GENERATED -->
<!-- Source: docs/backend-engineering-patterns.md -->

:::caution[Auto-generated]
This file is auto-generated from `docs/backend-engineering-patterns.md`. Do not edit directly.
:::



> A comprehensive guide to backend engineering best practices, patterns, and production readiness checklists compiled from authoritative sources including Zalando, Google, Microsoft, OWASP, AWS, and industry experts.

## Table of Contents

1. [API Design Patterns](#1-api-design-patterns)
2. [Database Patterns](#2-database-patterns)
3. [Security Patterns](#3-security-patterns)
4. [Reliability & Resilience Patterns](#4-reliability--resilience-patterns)
5. [Observability Patterns](#5-observability-patterns)
6. [Production Readiness Checklist](#6-production-readiness-checklist)

---

## 1. API Design Patterns

### 1.1 Resource-Oriented Design

**Source:** Zalando RESTful API Guidelines, Google API Design Guide

APIs should be designed around resources (nouns), not actions (verbs).

#### URL Structure Rules

```
✅ DO: /orders/{order-id}
✅ DO: /users/{user-id}/addresses
❌ DON'T: /getOrder
❌ DON'T: /createUser
```

#### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Path segments | `kebab-case` | `/shopping-carts` |
| Query parameters | `snake_case` | `?order_by=created_at` |
| JSON properties | `snake_case` | `{ "user_name": "john" }` |
| HTTP headers | `Kebab-Case` | `X-Flow-ID` |

#### Standard HTTP Methods

| Method | Description | Idempotent | Safe |
|--------|-------------|------------|------|
| `GET` | Read resource(s) | Yes | Yes |
| `POST` | Create resource | No | No |
| `PUT` | Full update (replace) | Yes | No |
| `PATCH` | Partial update | No | No |
| `DELETE` | Remove resource | Yes | No |

### 1.2 HTTP Status Codes

**Source:** Zalando RESTful API Guidelines

#### Success Codes

```
200 OK           - Successful GET, PUT, PATCH, or DELETE
201 Created      - Successful POST creating a resource
202 Accepted     - Async operation accepted, processing not complete
204 No Content   - Successful DELETE with no response body
207 Multi-Status - Batch operations with mixed results
```

#### Client Error Codes

```
400 Bad Request       - Malformed request syntax
401 Unauthorized      - Missing/invalid authentication
403 Forbidden         - Authenticated but not authorized
404 Not Found         - Resource doesn't exist
409 Conflict          - State conflict (e.g., duplicate)
422 Unprocessable     - Validation errors
429 Too Many Requests - Rate limit exceeded
```

#### Server Error Codes

```
500 Internal Server Error - Unexpected server error
502 Bad Gateway          - Upstream service error
503 Service Unavailable  - Temporary overload
504 Gateway Timeout      - Upstream service timeout
```

### 1.3 Error Response Format

**Source:** RFC 7807 (Problem Details), Zalando Guidelines

```json
{
  "type": "https://api.example.com/problems/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "The request body contains invalid data",
  "instance": "/orders/12345",
  "errors": [
    {
      "field": "email",
      "message": "Must be a valid email address"
    },
    {
      "field": "quantity",
      "message": "Must be greater than 0"
    }
  ]
}
```

### 1.4 Pagination

**Source:** Zalando RESTful API Guidelines

#### Cursor-Based Pagination (Recommended)

```http
GET /orders?cursor=eyJpZCI6MTIzfQ&limit=20

Response:
{
  "items": [...],
  "cursors": {
    "next": "eyJpZCI6MTQzfQ",
    "prev": "eyJpZCI6MTAzfQ"
  }
}
```

#### Offset-Based Pagination (Simple but Limited)

```http
GET /orders?offset=40&limit=20

Response:
{
  "items": [...],
  "total": 1000,
  "offset": 40,
  "limit": 20
}
```

**Anti-Pattern:** Don't use offset pagination for large datasets - performance degrades as offset increases.

### 1.5 Filtering, Sorting, and Field Selection

```http
# Filtering
GET /orders?status=pending&created_after=2024-01-01

# Sorting (use + for asc, - for desc)
GET /orders?sort=-created_at,+customer_name

# Field selection (sparse fieldsets)
GET /orders?fields=id,status,total_amount
```

### 1.6 Versioning

**Source:** Zalando Guidelines

#### URL Path Versioning (Recommended for Breaking Changes)

```http
GET /v1/orders
GET /v2/orders
```

#### Header-Based Versioning

```http
GET /orders
Accept: application/vnd.api+json;version=2
```

#### Deprecation Headers

```http
Deprecation: Sun, 01 Jan 2025 00:00:00 GMT
Sunset: Sun, 01 Jul 2025 00:00:00 GMT
Link: <https://api.example.com/v2/orders>; rel="successor-version"
```

### 1.7 Rate Limiting

**Source:** Zalando Guidelines

Include rate limit headers in responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1640995200
Retry-After: 60
```

### 1.8 Idempotency

**Source:** Stripe API, Zalando Guidelines

For non-idempotent operations (POST), support idempotency keys:

```http
POST /payments
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

{
  "amount": 1000,
  "currency": "USD"
}
```

Server should:
1. Store the idempotency key with the response
2. Return cached response for duplicate requests
3. Expire keys after 24 hours

### 1.9 API Design Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| Verbs in URLs | `/getUsers`, `/createOrder` | Use nouns: `/users`, `/orders` |
| Nested resources > 2 levels | `/users/1/orders/2/items/3` | Flatten: `/order-items/3` |
| Returning 200 for errors | Hides failures from clients | Use proper status codes |
| Exposing internal IDs | Security risk | Use UUIDs or slugs |
| Ignoring caching | Poor performance | Use ETags, Cache-Control |
| No pagination | Memory issues at scale | Always paginate lists |

---

## 2. Database Patterns

### 2.1 SQL Indexing Strategies

**Source:** PostgreSQL Documentation, Use The Index Luke

#### When to Create Indexes

```sql
-- Index columns used in WHERE clauses
CREATE INDEX idx_orders_status ON orders(status);

-- Index columns used in JOIN conditions
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Index columns used in ORDER BY
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Composite indexes for multi-column queries
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
```

#### Index Types (PostgreSQL)

| Type | Use Case |
|------|----------|
| B-Tree (default) | Equality, range queries, sorting |
| Hash | Equality comparisons only |
| GiST | Geometric data, full-text search |
| GIN | Arrays, JSONB, full-text search |
| BRIN | Large tables with natural ordering |

#### Partial Indexes (Save Space)

```sql
-- Index only active orders (most queries)
CREATE INDEX idx_active_orders ON orders(created_at)
WHERE status = 'active';
```

#### Covering Indexes (Index-Only Scans)

```sql
-- Include additional columns to avoid table lookup
CREATE INDEX idx_orders_covering ON orders(user_id)
INCLUDE (status, total_amount);
```

### 2.2 N+1 Query Problem

**Source:** Use The Index Luke

**Problem:** Fetching N child records requires N+1 queries.

```python
# ❌ N+1 Problem
orders = Order.objects.all()  # 1 query
for order in orders:
    print(order.customer.name)  # N queries

# ✅ Solution: Eager Loading
orders = Order.objects.select_related('customer').all()  # 1 query
```

**Solutions by ORM:**

```python
# Django
Order.objects.select_related('customer')      # FK/OneToOne
Order.objects.prefetch_related('items')       # ManyToMany/Reverse FK

# SQLAlchemy
session.query(Order).options(joinedload(Order.customer))
session.query(Order).options(selectinload(Order.items))

# TypeORM
orderRepo.find({ relations: ['customer', 'items'] })
```

### 2.3 Database Migration Best Practices

**Source:** Industry Standards

#### Safe Migration Patterns

```sql
-- ✅ Add nullable column (safe)
ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL;

-- ✅ Add column with default (safe in PostgreSQL 11+)
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;

-- ✅ Create index concurrently (non-blocking)
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
```

#### Dangerous Operations (Require Careful Planning)

```sql
-- ⚠️ Renaming columns (breaks existing queries)
-- Use a multi-step process:
-- 1. Add new column
-- 2. Dual-write to both columns
-- 3. Migrate reads to new column
-- 4. Drop old column

-- ⚠️ Changing column types
-- May require table rewrite, lock table

-- ⚠️ Adding NOT NULL constraint
-- Fails if existing NULL values
```

### 2.4 Connection Pool Management

```yaml
# Recommended settings
pool:
  min_connections: 5
  max_connections: 20
  connection_timeout: 30s
  idle_timeout: 10m
  max_lifetime: 1h
```

**Anti-Pattern:** Opening a new connection per request (connection overhead dominates).

### 2.5 Transaction Isolation Levels

| Level | Dirty Read | Non-Repeatable Read | Phantom Read |
|-------|------------|---------------------|--------------|
| READ UNCOMMITTED | Yes | Yes | Yes |
| READ COMMITTED | No | Yes | Yes |
| REPEATABLE READ | No | No | Yes |
| SERIALIZABLE | No | No | No |

**Default:** Most databases use READ COMMITTED. Use SERIALIZABLE for financial transactions.

---

## 3. Security Patterns

### 3.1 SQL Injection Prevention

**Source:** OWASP SQL Injection Prevention Cheat Sheet

#### Primary Defense: Parameterized Queries

```java
// ❌ VULNERABLE
String query = "SELECT * FROM users WHERE name = '" + userName + "'";

// ✅ SAFE - Parameterized Query
String query = "SELECT * FROM users WHERE name = ?";
PreparedStatement pstmt = connection.prepareStatement(query);
pstmt.setString(1, userName);
```

**By Language/Framework:**

```python
# Python (psycopg2)
cursor.execute("SELECT * FROM users WHERE name = %s", (user_name,))

# Node.js (pg)
client.query('SELECT * FROM users WHERE name = $1', [userName])

# Go (database/sql)
db.Query("SELECT * FROM users WHERE name = ?", userName)
```

### 3.2 Input Validation

**Source:** OWASP Input Validation Cheat Sheet

#### Validation Strategy

1. **Syntactic Validation:** Correct format (email, date, etc.)
2. **Semantic Validation:** Business logic correctness

```python
# ✅ Allowlist approach (recommended)
VALID_STATUSES = ['pending', 'active', 'completed']
if status not in VALID_STATUSES:
    raise ValidationError("Invalid status")

# ❌ Denylist approach (easily bypassed)
if '<script>' in user_input:  # Attacker uses <SCRIPT> or encoding
    raise ValidationError("Invalid input")
```

#### Server-Side Validation is Mandatory

```javascript
// Client-side validation is for UX only
// Server MUST validate all input

app.post('/users', (req, res) => {
  // Always validate on server
  const { error, value } = userSchema.validate(req.body);
  if (error) return res.status(422).json({ errors: error.details });
});
```

### 3.3 Secrets Management

**Source:** OWASP Secrets Management Cheat Sheet, AWS Secrets Manager Best Practices

#### Core Principles

1. **Never hardcode secrets** in source code
2. **Use a secrets manager** (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault)
3. **Rotate secrets regularly** (automate rotation)
4. **Apply least privilege** access to secrets
5. **Audit all secret access**

#### Secrets Injection Patterns

```yaml
# ❌ Hardcoded (NEVER DO THIS)
database:
  password: "my-secret-password"

# ✅ Environment Variable
database:
  password: ${DB_PASSWORD}

# ✅ Secrets Manager Reference
database:
  password: !secret aws/secretsmanager/db-credentials
```

#### Kubernetes Secrets with Sidecar

```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: app
    volumeMounts:
    - name: secrets
      mountPath: "/mnt/secrets"
      readOnly: true
  - name: vault-agent
    image: vault:latest
    args: ["agent", "-config=/etc/vault/config.hcl"]
  volumes:
  - name: secrets
    emptyDir:
      medium: "Memory"  # In-memory, not on disk
```

#### Secret Lifecycle

1. **Creation:** Generate cryptographically secure secrets
2. **Rotation:** Automate rotation (every 30-90 days)
3. **Revocation:** Immediate revocation on compromise
4. **Expiration:** Set TTL on all secrets

### 3.4 Authentication & Authorization

#### Password Storage

```python
# ✅ Use bcrypt, scrypt, or Argon2
import bcrypt

hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))
bcrypt.checkpw(password.encode(), hashed)

# ❌ NEVER use MD5, SHA1, or unsalted hashes
```

#### JWT Best Practices

```javascript
// ✅ Short-lived access tokens
const accessToken = jwt.sign(payload, secret, { expiresIn: '15m' });

// ✅ Refresh tokens for session extension
const refreshToken = jwt.sign({ userId }, refreshSecret, { expiresIn: '7d' });

// ✅ Always validate: signature, expiration, issuer, audience
jwt.verify(token, secret, {
  issuer: 'your-api',
  audience: 'your-app',
});
```

### 3.5 Security Headers

```http
# Essential Security Headers
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

### 3.6 Security Anti-Patterns

| Anti-Pattern | Risk | Mitigation |
|--------------|------|------------|
| Secrets in git | Credential exposure | Use .gitignore, secret scanning |
| Logging sensitive data | Data breach | Sanitize logs, mask PII |
| Trusting client input | Injection attacks | Server-side validation |
| Verbose error messages | Information disclosure | Generic user-facing errors |
| No rate limiting | DoS, brute force | Implement rate limits |
| Outdated dependencies | Known vulnerabilities | Regular dependency updates |

---

## 4. Reliability & Resilience Patterns

### 4.1 Circuit Breaker Pattern

**Source:** Martin Fowler, microservices.io, Netflix Hystrix

Prevents cascading failures by "breaking the circuit" when a service is failing.

#### States

```
┌─────────┐    Failure threshold    ┌──────────┐
│ CLOSED  │ ───────────────────────>│  OPEN    │
│(normal) │                          │(failing) │
└─────────┘                          └──────────┘
     ^                                    │
     │        ┌────────────┐             │
     │        │ HALF-OPEN  │<────────────┘
     │        │  (testing) │    Timeout expires
     │        └────────────┘
     │              │
     └──────────────┘
       Success threshold
```

#### Implementation

```python
from circuitbreaker import circuit

@circuit(failure_threshold=5, recovery_timeout=30)
def call_external_service():
    response = requests.get('https://external-api.com/data')
    response.raise_for_status()
    return response.json()

# Usage with fallback
try:
    data = call_external_service()
except CircuitBreakerError:
    data = get_cached_data()  # Fallback
```

#### Configuration Guidelines

| Parameter | Recommended | Description |
|-----------|-------------|-------------|
| Failure threshold | 5-10 | Failures before opening |
| Recovery timeout | 30-60s | Time before half-open |
| Success threshold | 3-5 | Successes before closing |
| Timeout | 1-5s | Request timeout |

### 4.2 Retry Pattern with Exponential Backoff

```python
import time
import random

def retry_with_backoff(func, max_retries=3, base_delay=1):
    for attempt in range(max_retries):
        try:
            return func()
        except TransientError as e:
            if attempt == max_retries - 1:
                raise
            
            # Exponential backoff with jitter
            delay = base_delay * (2 ** attempt)
            jitter = random.uniform(0, delay * 0.1)
            time.sleep(delay + jitter)
```

**Important:** Only retry on transient errors (network, 503), not on 4xx errors.

### 4.3 Bulkhead Pattern

Isolate failures to prevent them from affecting the entire system.

```python
from concurrent.futures import ThreadPoolExecutor

# Separate thread pools for different services
payment_executor = ThreadPoolExecutor(max_workers=10, thread_name_prefix='payment')
inventory_executor = ThreadPoolExecutor(max_workers=5, thread_name_prefix='inventory')

# If inventory service is slow, it won't exhaust payment workers
```

### 4.4 Timeout Pattern

```python
import asyncio

async def call_service_with_timeout():
    try:
        result = await asyncio.wait_for(
            external_service_call(),
            timeout=5.0  # 5 second timeout
        )
        return result
    except asyncio.TimeoutError:
        return fallback_value()
```

**Guidelines:**
- Set timeouts slightly above the 99th percentile latency
- Cascade timeouts (outer > inner)
- Log all timeouts for debugging

### 4.5 Saga Pattern for Distributed Transactions

**Source:** microservices.io

When a business transaction spans multiple services, use sagas instead of distributed transactions.

#### Choreography (Event-Driven)

```
Order Service      Customer Service      Inventory Service
     │                    │                     │
     │ OrderCreated       │                     │
     │───────────────────>│                     │
     │                    │ CreditReserved      │
     │                    │────────────────────>│
     │                    │                     │ InventoryReserved
     │<─────────────────────────────────────────│
     │ OrderApproved      │                     │
```

#### Orchestration (Central Coordinator)

```python
class CreateOrderSaga:
    def execute(self, order):
        try:
            # Step 1: Reserve credit
            self.customer_service.reserve_credit(order.customer_id, order.total)
            
            # Step 2: Reserve inventory
            self.inventory_service.reserve(order.items)
            
            # Step 3: Create order
            self.order_service.create(order)
            
        except CreditReservationFailed:
            pass  # No compensation needed
        except InventoryReservationFailed:
            # Compensate step 1
            self.customer_service.release_credit(order.customer_id, order.total)
```

### 4.6 Transactional Outbox Pattern

**Source:** microservices.io

Ensures atomic database updates and message publishing without distributed transactions.

```sql
-- Single transaction
BEGIN;
  INSERT INTO orders (id, customer_id, total) VALUES (...);
  INSERT INTO outbox (id, aggregate_type, payload) VALUES (..., 'Order', '{"event": "OrderCreated", ...}');
COMMIT;

-- Separate process polls outbox and publishes to message broker
```

### 4.7 Health Checks

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/health/live")
def liveness():
    """Is the process running?"""
    return {"status": "ok"}

@app.get("/health/ready")
def readiness():
    """Can the service handle requests?"""
    checks = {
        "database": check_database(),
        "cache": check_cache(),
        "dependencies": check_dependencies(),
    }
    
    if all(checks.values()):
        return {"status": "ready", "checks": checks}
    else:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "checks": checks}
        )
```

---

## 5. Observability Patterns

### 5.1 The Three Pillars

**Source:** OpenTelemetry

| Pillar | Purpose | Examples |
|--------|---------|----------|
| **Logs** | Discrete events | Error messages, audit trails |
| **Metrics** | Aggregate measurements | Request count, latency percentiles |
| **Traces** | Request flow across services | Distributed transaction path |

### 5.2 Structured Logging

```python
import structlog

logger = structlog.get_logger()

# ✅ Structured logging
logger.info(
    "order_created",
    order_id="12345",
    customer_id="67890",
    total_amount=99.99,
    items_count=3
)

# Output (JSON):
# {"event": "order_created", "order_id": "12345", "customer_id": "67890", 
#  "total_amount": 99.99, "items_count": 3, "timestamp": "2024-01-15T10:30:00Z"}

# ❌ Unstructured logging (hard to parse/query)
logger.info(f"Created order 12345 for customer 67890, total: $99.99")
```

#### Log Levels

| Level | Use Case |
|-------|----------|
| ERROR | Failures requiring immediate attention |
| WARN | Potential issues, degraded functionality |
| INFO | Significant business events |
| DEBUG | Detailed diagnostic information |

### 5.3 Metrics (RED & USE Methods)

#### RED Method (Request-Driven Services)

```python
from prometheus_client import Counter, Histogram

# Rate: requests per second
request_count = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

# Errors: error rate
error_count = Counter(
    'http_errors_total', 
    'Total HTTP errors',
    ['method', 'endpoint', 'error_type']
)

# Duration: latency distribution
request_latency = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint'],
    buckets=[.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10]
)
```

#### USE Method (Resources)

- **Utilization:** % time resource is busy
- **Saturation:** Queue length / waiting work
- **Errors:** Error count

### 5.4 Distributed Tracing

**Source:** OpenTelemetry

```python
from opentelemetry import trace
from opentelemetry.trace import SpanKind

tracer = trace.get_tracer(__name__)

@app.route('/orders', methods=['POST'])
def create_order():
    with tracer.start_as_current_span(
        "create_order",
        kind=SpanKind.SERVER
    ) as span:
        span.set_attribute("order.customer_id", customer_id)
        
        # Child span for database operation
        with tracer.start_as_current_span("db.insert_order"):
            order = db.insert(order_data)
        
        # Child span for external service call
        with tracer.start_as_current_span(
            "payment.process",
            kind=SpanKind.CLIENT
        ):
            payment_result = payment_service.process(order)
        
        return order
```

#### Trace Context Propagation

```http
# W3C Trace Context headers
traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
tracestate: vendor=value
```

### 5.5 SLI/SLO/SLA

**Source:** Google SRE Book

| Term | Definition | Example |
|------|------------|---------|
| **SLI** (Indicator) | Metric measuring service level | 99th percentile latency |
| **SLO** (Objective) | Target value for SLI | 99th percentile < 200ms |
| **SLA** (Agreement) | Contract with consequences | 99.9% uptime or credits |

#### Key SLIs

```yaml
availability:
  good_events: successful_requests
  total_events: total_requests
  slo: 99.9%

latency:
  good_events: requests_under_200ms
  total_events: total_requests
  slo: 99%

error_rate:
  good_events: non_error_requests
  total_events: total_requests
  slo: 99.5%
```

### 5.6 Correlation IDs

```python
import uuid
from contextvars import ContextVar

request_id: ContextVar[str] = ContextVar('request_id')

@app.before_request
def set_request_id():
    # Use incoming header or generate new
    rid = request.headers.get('X-Request-ID', str(uuid.uuid4()))
    request_id.set(rid)
    
@app.after_request
def add_request_id_header(response):
    response.headers['X-Request-ID'] = request_id.get()
    return response

# Include in all logs
logger.info("Processing order", request_id=request_id.get())
```

---

## 6. Production Readiness Checklist

### 6.1 The Twelve-Factor App

**Source:** 12factor.net

| Factor | Description | Implementation |
|--------|-------------|----------------|
| 1. Codebase | One codebase, many deploys | Git repository |
| 2. Dependencies | Explicitly declare dependencies | package.json, requirements.txt |
| 3. Config | Store config in environment | Environment variables |
| 4. Backing Services | Treat as attached resources | Connection strings via env vars |
| 5. Build, Release, Run | Strict separation | CI/CD pipelines |
| 6. Processes | Stateless processes | No local session storage |
| 7. Port Binding | Export services via port | Self-contained web server |
| 8. Concurrency | Scale via process model | Horizontal scaling |
| 9. Disposability | Fast startup, graceful shutdown | Handle SIGTERM |
| 10. Dev/Prod Parity | Keep environments similar | Containers, IaC |
| 11. Logs | Treat as event streams | stdout/stderr |
| 12. Admin Processes | Run as one-off processes | Migration scripts |

### 6.2 Pre-Production Checklist

#### Code Quality

- [ ] All tests passing (unit, integration, e2e)
- [ ] Code coverage meets threshold (>80%)
- [ ] No critical security vulnerabilities (SAST/DAST)
- [ ] Dependencies up to date, no known CVEs
- [ ] Code reviewed and approved

#### Configuration

- [ ] No hardcoded secrets
- [ ] Environment-specific configs externalized
- [ ] Feature flags for new functionality
- [ ] Database migrations tested

#### Observability

- [ ] Structured logging implemented
- [ ] Metrics exposed (Prometheus format)
- [ ] Distributed tracing enabled
- [ ] Health check endpoints (`/health/live`, `/health/ready`)
- [ ] Dashboards created
- [ ] Alerts configured

#### Resilience

- [ ] Graceful shutdown handling
- [ ] Circuit breakers for external calls
- [ ] Retry logic with backoff
- [ ] Timeouts configured
- [ ] Rate limiting enabled
- [ ] Fallback mechanisms in place

#### Security

- [ ] Authentication/authorization implemented
- [ ] Input validation on all endpoints
- [ ] Security headers configured
- [ ] TLS/HTTPS enforced
- [ ] Secrets management in place
- [ ] API rate limiting enabled

#### Performance

- [ ] Load testing completed
- [ ] Database queries optimized
- [ ] Caching strategy implemented
- [ ] Connection pooling configured
- [ ] Response compression enabled

### 6.3 Deployment Checklist

- [ ] Blue-green or canary deployment strategy
- [ ] Rollback plan documented and tested
- [ ] Database migrations backward compatible
- [ ] Feature flags for gradual rollout
- [ ] Smoke tests after deployment
- [ ] Monitoring dashboards ready
- [ ] On-call team notified

### 6.4 Incident Response Preparation

- [ ] Runbooks for common issues
- [ ] Escalation paths defined
- [ ] Communication channels established
- [ ] Postmortem template ready
- [ ] Error budget tracking

---

## References

### API Design
- [Zalando RESTful API Guidelines](https://opensource.zalando.com/restful-api-guidelines/)
- [Microsoft REST API Guidelines](https://github.com/microsoft/api-guidelines)
- [Google API Design Guide](https://google.aip.dev/)

### Security
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [AWS Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)

### Database
- [PostgreSQL Documentation](https://www.postgresql.org/docs/current/indexes.html)
- [Use The Index, Luke](https://use-the-index-luke.com/)

### Reliability
- [Martin Fowler - Circuit Breaker](https://martinfowler.com/bliki/CircuitBreaker.html)
- [microservices.io Patterns](https://microservices.io/patterns/)
- [AWS Well-Architected Reliability Pillar](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/)

### Observability
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Google SRE Book](https://sre.google/sre-book/table-of-contents/)

### Production
- [The Twelve-Factor App](https://12factor.net/)

---

*This document is maintained as part of the Backend Engineering Kit. Last updated: 2024*
