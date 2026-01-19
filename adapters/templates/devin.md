# Devin AI Rules

> Devin Autonomous AI Software Engineer Configuration

## Context

This project uses **Backend Engineering Kit (BEK)** for production backend patterns.

**CLI:** `bek` (npm: production-backend-kit)

## Devin Integration

### Initial Setup

When Devin starts a task:

```bash
# Install BEK CLI
npm install -g production-backend-kit

# Verify installation
bek doctor

# List available patterns
bek list
```

### Task Execution

Before implementing any backend feature:

```bash
# 1. Search for relevant patterns
bek search "<feature topic>"

# 2. Review pattern details
bek show <pattern-id>

# 3. Follow checklist items
bek show <pattern-id>  # Check "Checklist" section
```

### Implementation Guidelines

Devin should follow this workflow:

```
1. SEARCH: Find relevant BEK pattern
   bek search "authentication"

2. ANALYZE: Review pattern structure
   bek show auth-jwt-stateless

3. IMPLEMENT: Follow pattern guidance
   - Use recommended structure
   - Avoid documented pitfalls
   - Include observability

4. VALIDATE: Run quality gate
   bek gate --checklist checklist-security-review

5. TEST: Cover checklist items
   - Positive cases
   - Error scenarios from Pitfalls
```

## Autonomous Coding Rules

### Pattern Compliance

```yaml
before_implementation:
  - search: bek search "<topic>"
  - review: bek show <pattern-id>
  
during_implementation:
  - follow: Pattern structure
  - avoid: Documented pitfalls
  - include: Error handling, logging, metrics

after_implementation:
  - validate: bek gate --checklist <id>
  - test: Cover checklist items
```

### Error Handling

Always implement error handling per BEK:

```bash
bek show api-error-model
# Follow structured error format
# Include error codes
# Proper HTTP status mapping
```

### Security Considerations

For any auth/security work:

```bash
bek gate --checklist checklist-security-review
# Must pass all items before PR
```

## PR Creation

Devin PRs should include:

```markdown
## BEK Compliance

- [ ] Pattern followed: `<pattern-id>`
- [ ] Checklist passed: `bek gate --checklist <id>`
- [ ] Pitfalls avoided: [list from pattern]
- [ ] Tests cover: Checklist items
```

## Communication

When reporting progress:

```
✅ Implemented following BEK pattern: <pattern-id>
✅ Quality gate passed: <checklist-id>
⚠️ Note: [any deviations from pattern]
```
