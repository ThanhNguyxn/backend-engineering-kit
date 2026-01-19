# Junie Rules for Backend Kit (JetBrains AI Agent)

> Configure in JetBrains IDE with Junie AI Agent

## Context

This project uses **Backend Engineering Kit (BEK)** for production backend patterns.

**CLI:** `bek` (npm: production-backend-kit)

## IDE Integration

### IntelliJ IDEA / WebStorm / PyCharm / GoLand (with Junie)

1. **Terminal Integration:**
   ```bash
   # Run BEK commands in IDE terminal
   bek search "<feature>"
   bek show <pattern-id>
   ```

2. **External Tools Setup:**
   - Add BEK commands as External Tools
   - Bind keyboard shortcuts for quick access

## AI Assistant Instructions

When JetBrains AI suggests implementations:

### Validation Workflow

1. **Before implementing:**
   ```bash
   bek search "<feature>" --scope <scope>
   ```

2. **Check pattern:**
   ```bash
   bek show <pattern-id>
   ```

3. **After implementing:**
   ```bash
   bek gate --checklist <checklist-id>
   ```

## Scope by IDE

| IDE | Primary Scopes | Key Patterns |
|-----|---------------|--------------|
| IntelliJ IDEA | `api`, `database` | Java/Kotlin patterns |
| WebStorm | `api`, `reliability` | Node.js patterns |
| PyCharm | `api`, `database` | Python patterns |
| GoLand | `api`, `reliability` | Go patterns |

## Quick Commands

```bash
# List patterns for API development
bek list --domain api

# Database patterns
bek list --domain database

# Security review
bek gate --checklist checklist-security-review

# Production readiness
bek gate --checklist checklist-prod-readiness
```

## Live Templates

Add BEK references as Live Templates:

```java
// Pattern: $PATTERN_ID$
// Command: bek show $PATTERN_ID$
$CODE$
```

## Inspection Integration

Reference BEK patterns in code comments for review:

```kotlin
// BEK: api-error-model
// Implements consistent error response format
data class ApiError(
    val code: String,
    val message: String,
    val details: Map<String, Any>? = null
)
```
