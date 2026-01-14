# Copilot Instructions for Backend Kit

## Overview
This project uses the Production Backend Kit for backend development patterns.

## Workflow

### 1. Pattern Discovery
Before implementing backend features, search the knowledge base:
```
kit search "<feature keywords>"
```

### 2. Pattern Application
Follow the matched pattern structure:
- **Problem**: Understand what issue we're solving
- **Solution**: Follow the recommended approach
- **Pitfalls**: Avoid common mistakes
- **Checklist**: Complete all items

### 3. Quality Gate
Validate implementation against checklists:
```
kit gate --checklist <checklist-id>
```

## Available Checklists
- `checklist-api-review` - REST API best practices
- `checklist-db-review` - Database schema, queries, migrations
- `checklist-security-review` - Security controls
- `checklist-reliability-review` - Resilience patterns
- `checklist-prod-readiness` - Pre-deployment checks
