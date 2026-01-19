# Backend Engineering Quick Reference

> Concise, actionable patterns for AI coding assistants to generate better backend code.

## API Design Rules

### URL & Naming
```
✅ /users/{user-id}/orders     # Resource-oriented, kebab-case paths
✅ ?order_by=created_at        # snake_case query params
✅ { "user_name": "john" }     # snake_case JSON

❌ /getUsers, /createOrder     # No verbs in URLs
❌ /users/1/orders/2/items/3   # Max 2 levels nesting
```

### HTTP Methods & Status Codes
```
GET    → 200 (list/item), 404 (not found)
POST   → 201 (created), 400 (bad request), 409 (conflict)
PUT    → 200 (updated), 404 (not found)
PATCH  → 200 (updated), 422 (validation error)
DELETE → 204 (deleted), 404 (not found)
```

### Error Response (RFC 7807)
```json
{
  "type": "https://api.example.com/problems/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "The request body contains invalid data",
  "errors": [{ "field": "email", "message": "Invalid email" }]
}
```

### Pagination (Cursor-Based)
```http
GET /orders?cursor=eyJpZCI6MTIzfQ&limit=20

Response: { "items": [...], "cursors": { "next": "...", "prev": "..." } }
```

---

## Database Patterns

### Parameterized Queries (ALWAYS)
```python
# ✅ Safe
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))

# ❌ SQL Injection vulnerable
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
```

### N+1 Prevention
```python
# ❌ N+1 Problem
for order in Order.objects.all():
    print(order.customer.name)  # N queries

# ✅ Eager Loading
Order.objects.select_related('customer')       # FK
Order.objects.prefetch_related('items')        # M2M
```

### Index Guidelines
```sql
-- Index WHERE columns
CREATE INDEX idx_orders_status ON orders(status);

-- Index JOIN columns
CREATE INDEX idx_items_order_id ON order_items(order_id);

-- Composite for multi-column queries (order matters!)
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

-- Partial index for common queries
CREATE INDEX idx_active_orders ON orders(created_at) WHERE status = 'active';
```

---

## Security Essentials

### Input Validation
```python
# ✅ Allowlist validation
VALID_STATUSES = ['pending', 'active', 'completed']
if status not in VALID_STATUSES:
    raise ValidationError("Invalid status")

# ✅ Type coercion
user_id = int(request.params.get('user_id'))

# ❌ Denylist (easily bypassed)
if '<script>' in input:  # Attacker uses encoding
```

### Secrets Management
```yaml
# ❌ Never hardcode
password: "my-secret"

# ✅ Environment variables
password: ${DB_PASSWORD}

# ✅ Secrets manager
password: !secret aws/secretsmanager/db-creds
```

### Password Storage
```python
import bcrypt
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))
```

---

## Resilience Patterns

### Circuit Breaker
```python
@circuit(failure_threshold=5, recovery_timeout=30)
def call_external_service():
    return requests.get('https://api.example.com', timeout=5).json()

try:
    data = call_external_service()
except CircuitBreakerError:
    data = get_cached_fallback()
```

### Retry with Backoff
```python
def retry_with_backoff(func, max_retries=3, base_delay=1):
    for attempt in range(max_retries):
        try:
            return func()
        except TransientError:
            if attempt == max_retries - 1:
                raise
            delay = base_delay * (2 ** attempt) + random.uniform(0, 0.1)
            time.sleep(delay)
```

### Health Checks
```python
@app.get("/health/live")
def liveness():
    return {"status": "ok"}

@app.get("/health/ready")
def readiness():
    return {
        "status": "ready",
        "checks": {
            "database": check_db(),
            "cache": check_cache()
        }
    }
```

---

## Observability

### Structured Logging
```python
logger.info(
    "order_created",
    order_id="12345",
    customer_id="67890",
    amount=99.99
)
# Output: {"event": "order_created", "order_id": "12345", ...}
```

### Key Metrics (RED Method)
```python
# Rate
request_count = Counter('http_requests_total', ['method', 'endpoint', 'status'])

# Errors
error_count = Counter('http_errors_total', ['method', 'endpoint', 'error_type'])

# Duration
request_latency = Histogram('http_request_duration_seconds', ['method', 'endpoint'])
```

### Correlation IDs
```python
@app.before_request
def set_request_id():
    request_id.set(request.headers.get('X-Request-ID', str(uuid.uuid4())))
```

---

## Common Anti-Patterns to Avoid

| Anti-Pattern | Better Approach |
|--------------|-----------------|
| Verbs in URLs (`/getUsers`) | Resource nouns (`/users`) |
| String concatenation in SQL | Parameterized queries |
| N+1 queries in loops | Eager loading |
| Hardcoded secrets | Environment/secrets manager |
| No timeouts on HTTP calls | Always set timeouts |
| No pagination on list endpoints | Cursor-based pagination |
| Denylist input validation | Allowlist validation |
| Catching all exceptions | Catch specific exceptions |
| Logging sensitive data | Sanitize/mask PII |
| Synchronous external calls | Async with circuit breaker |

---

## Code Generation Checklist

When generating backend code, ensure:

- [ ] All SQL uses parameterized queries
- [ ] List endpoints have pagination
- [ ] External calls have timeouts and error handling
- [ ] Input is validated on server side
- [ ] Errors return proper HTTP status codes
- [ ] Secrets come from environment/secrets manager
- [ ] Logs are structured with correlation IDs
- [ ] Health check endpoints exist
- [ ] Database queries use appropriate indexes
- [ ] Async operations have circuit breakers
