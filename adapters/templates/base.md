# Backend Kit Adapter Template

This is the base template for AI tool adapters. It defines the standard pipeline that all adapters should follow.

## Pipeline

1. **Parse**: Understand the user's request context and intent
2. **Search KB**: Use `kit search` to find relevant patterns/checklists
3. **Apply Pattern**: Generate code following the matched pattern
4. **Quality Gate**: Run `kit gate` to validate against checklist

## CLI Integration

### Search Knowledge Base
```bash
kit search "<query>" --scope <scope> --works-with <stack>
```

### Run Quality Gate
```bash
kit gate --checklist <checklist-id>
```

## Available Scopes
- api
- database
- security
- reliability
- observability

## Available Checklists
- checklist-api-review
- checklist-db-review
- checklist-security-review
- checklist-reliability-review
- checklist-prod-readiness

## Instructions

When generating backend code:

1. Search for relevant patterns first
2. Follow the pattern's Solution section
3. Avoid the pattern's Pitfalls
4. Complete the pattern's Checklist items
