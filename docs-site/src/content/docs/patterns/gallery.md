---
title: Pattern Gallery
description: Browse all backend engineering patterns by scope and level
---

# Pattern Gallery

Browse production-ready patterns organized by scope and difficulty level.

## Filter by Scope

<div class="filter-tags">
  <a href="#api" class="filter-tag api">API</a>
  <a href="#database" class="filter-tag db">Database</a>
  <a href="#security" class="filter-tag sec">Security</a>
  <a href="#reliability" class="filter-tag rel">Reliability</a>
  <a href="#observability" class="filter-tag obs">Observability</a>
</div>

---

## API Patterns {#api}

<div class="pattern-card">

### API Error Model

**Level:** Beginner | **Scope:** API

Consistent error response format with codes, messages, and request IDs.

```bash
bek search "error model" --scope api
```

</div>

<div class="pattern-card">

### Request Validation

**Level:** Beginner | **Scope:** API

Input validation with schemas and sanitization before processing.

```bash
bek search "request validation" --scope api
```

</div>

<div class="pattern-card">

### Pagination, Filtering & Sorting

**Level:** Beginner | **Scope:** API

Standard query parameters for list endpoints with consistent structure.

</div>

<div class="pattern-card">

### API Versioning

**Level:** Intermediate | **Scope:** API

URL and header-based versioning strategies for backward compatibility.

</div>

<div class="pattern-card">

### Idempotency Keys

**Level:** Advanced | **Scope:** API

Safe retry handling with idempotency keys for critical operations.

</div>

<div class="pattern-card">

### Webhook Signatures

**Level:** Advanced | **Scope:** API

HMAC signatures for secure webhook delivery and verification.

</div>

---

## Database Patterns {#database}

<div class="pattern-card">

### Database Indexing Basics

**Level:** Intermediate | **Scope:** Database

When and how to create efficient indexes for query performance.

</div>

<div class="pattern-card">

### N+1 Query Avoidance

**Level:** Intermediate | **Scope:** Database

Preventing N+1 queries in ORMs with eager loading and batching.

</div>

<div class="pattern-card">

### Schema Constraints

**Level:** Intermediate | **Scope:** Database

Enforcing data integrity at database level with constraints.

</div>

<div class="pattern-card">

### Soft Delete & Audit Trail

**Level:** Intermediate | **Scope:** Database

Logical deletion with audit history for compliance.

</div>

<div class="pattern-card">

### Transaction Boundaries

**Level:** Advanced | **Scope:** Database

Proper transaction scoping and isolation levels.

</div>

<div class="pattern-card">

### Migration Strategy

**Level:** Advanced | **Scope:** Database

Zero-downtime database migrations in production.

</div>

---

## Security Patterns {#security}

<div class="pattern-card">

### Password Storage

**Level:** Beginner | **Scope:** Security

Secure password hashing with bcrypt/argon2.

</div>

<div class="pattern-card">

### AuthN/AuthZ Boundary

**Level:** Intermediate | **Scope:** Security

Separating authentication from authorization cleanly.

</div>

<div class="pattern-card">

### Rate Limiting

**Level:** Intermediate | **Scope:** Security

Protecting APIs from abuse with sliding window rate limits.

</div>

<div class="pattern-card">

### Secrets Management

**Level:** Intermediate | **Scope:** Security

Secure handling of API keys and credentials.

</div>

<div class="pattern-card">

### Threat Checklist

**Level:** Advanced | **Scope:** Security

OWASP-based security checklist for comprehensive review.

</div>

---

## Reliability Patterns {#reliability}

<div class="pattern-card">

### Timeout Configuration

**Level:** Beginner | **Scope:** Reliability

Setting appropriate timeouts for all external calls.

</div>

<div class="pattern-card">

### Retries with Backoff

**Level:** Intermediate | **Scope:** Reliability

Exponential backoff with jitter for transient failures.

</div>

<div class="pattern-card">

### Circuit Breaker

**Level:** Advanced | **Scope:** Reliability

Fail-fast pattern for external dependencies.

</div>

<div class="pattern-card">

### Dead Letter Queue

**Level:** Advanced | **Scope:** Reliability

Handling failed message processing gracefully.

</div>

<div class="pattern-card">

### Outbox Pattern

**Level:** Advanced | **Scope:** Reliability

Reliable event publishing with database consistency.

</div>

---

## Observability Patterns {#observability}

<div class="pattern-card">

### Structured Logging

**Level:** Beginner | **Scope:** Observability

JSON logging with context, levels, and correlation.

</div>

<div class="pattern-card">

### Correlation IDs

**Level:** Intermediate | **Scope:** Observability

Request tracing across services and logs.

</div>

<div class="pattern-card">

### RED & USE Metrics

**Level:** Advanced | **Scope:** Observability

Rate, Errors, Duration + Utilization, Saturation, Errors framework.

</div>

---

## Quick Start

```bash
# Search patterns
bek search "error handling"

# Filter by scope
bek search "authentication" --scope security

# List all patterns
bek list --type pattern
```

Run `bek list --type pattern` to see the current count of available patterns.
