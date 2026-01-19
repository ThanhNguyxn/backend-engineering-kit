---
title: "Content Spec v1"
description: "> Specification for patterns and checklists in Backend Engineering Kit"
generated: true
---

<!-- AUTO-GENERATED -->
<!-- Source: docs/content-spec-v1.md -->

:::caution[Auto-generated]
This file is auto-generated from `docs/content-spec-v1.md`. Do not edit directly.
:::



> Specification for patterns and checklists in Backend Engineering Kit

## Overview

All patterns and checklists must have YAML frontmatter with required metadata fields. This ensures consistency, searchability, and proper rendering in the docs site.

## Required Fields (Error if missing)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Unique kebab-case identifier | `api-error-model` |
| `title` | string | Human-readable title | `API Error Model` |
| `tags` | string[] | Lowercase tags for search | `[api, error-handling]` |

## Recommended Fields (Warning if missing)

| Field | Type | Description | Values |
|-------|------|-------------|--------|
| `scope` | string | Primary category | `api`, `database`, `security`, `reliability`, `observability` |
| `level` | string | Difficulty level | `beginner`, `intermediate`, `advanced` |
| `maturity` | string | Content stability | `stable`, `beta`, `experimental` |
| `stacks` | string[] | Applicable tech stacks | `[nodejs, python, go, all]` |

## Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Brief description (1-2 sentences) |
| `version` | string | Content version (semver) |
| `works_with` | string[] | Related patterns/tools |
| `references` | string[] | External URLs |

## ID Naming Convention

### Patterns

Format: `{scope}-{name}` using kebab-case

| Scope | Prefix Examples |
|-------|-----------------|
| API | `api-error-model`, `api-pagination` |
| Database | `db-indexing`, `db-migrations` |
| Security | `sec-rate-limiting`, `sec-auth` |
| Reliability | `rel-circuit-breaker`, `rel-timeouts` |
| Observability | `obs-logging`, `obs-metrics` |

### Checklists

Format: `checklist-{scope}-{name}`

Examples:
- `checklist-api-review`
- `checklist-db-review`
- `checklist-prod-readiness`

## Heading Structure

### Patterns (Required Sections)

```markdown
# {Title}

## Problem
{What problem does this solve?}

## When to use
{Context and conditions}

## Solution
{Step-by-step implementation}

## Pitfalls
{Common mistakes to avoid}

## Checklist
{Verification items}
```

### Checklists (Required Sections)

```markdown
# {Title}

{Brief introduction}

## {Category 1}
- [ ] Item 1
- [ ] Item 2

## {Category 2}
- [ ] Item 3
```

## Example Pattern Frontmatter

```yaml
---
id: api-error-model
title: API Error Model
tags: [api, error-handling, rest, http]
scope: api
level: beginner
maturity: stable
stacks: [nodejs, python, go, all]
description: Consistent error response format with codes and details
---
```

## Example Checklist Frontmatter

```yaml
---
id: checklist-api-review
title: API Review Checklist
tags: [api, rest, review, quality]
scope: api
level: intermediate
maturity: stable
description: REST API review checklist for pre-deployment
version: 1.0.0
---
```

## Validation

Run linter to check compliance:

```bash
# Check for issues
bek lint

# Auto-fix missing fields
bek lint --fix

# JSON output for CI
bek lint --json
```

## CI Integration

The CI pipeline will:
1. Run `bek lint --json`
2. Fail on errors (missing required fields)
3. Allow warnings (missing recommended fields)
4. Report warning count in PR comment
