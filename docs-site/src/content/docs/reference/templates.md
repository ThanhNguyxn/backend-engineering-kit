---
title: "Templates"
description: "> Guide to the template system for `bek init`."
generated: true
---

<!-- AUTO-GENERATED -->
<!-- Source: docs\templates.md -->

:::caution[Auto-generated]
This file is auto-generated from `docs\templates.md`. Do not edit directly.
:::



> Guide to the template system for `bek init`.

## Available Templates

### Minimal

Basic setup with patterns only.

**Created files:**
- `bek.config.json`
- `.shared/production-backend-kit/patterns/sample-pattern.md`
- `.shared/production-backend-kit/checklists/` (empty)
- `.shared/production-backend-kit/db/` (empty)

**Use when:**
- Learning the kit
- Small projects
- Just need pattern search

### Standard (Default)

Patterns + checklists + validation.

**Created files:**
- Everything in Minimal, plus:
- `.shared/production-backend-kit/checklists/sample-checklist.md`
- Validation enabled in config

**Use when:**
- Most projects
- Want quality gates
- Team collaboration

### Advanced (Option B)

Full setup with all features.

**Created files:**
- Everything in Standard, plus:
- `adapters/claude/`, `cursor/`, `copilot/`, `codex/`
- `.github/workflows/ci.yml`

**Use when:**
- Production projects
- Need AI adapters
- Want CI/CD integration

## Usage

```bash
# Interactive mode
bek init

# Non-interactive with defaults
bek init -y

# Specific template
bek init --template advanced

# Custom target
bek init --template standard --target ./my-project

# Preview only
bek init --template minimal --dry-run
```

## Creating Custom Templates

Templates are defined in `cli/src/commands/init.ts`:

```typescript
const TEMPLATES: Record<string, Template> = {
  minimal: {
    name: 'Minimal',
    description: 'Basic setup with patterns only',
    features: ['patterns', 'search']
  },
  // Add your template here
};
```

### Template Features

| Feature | Description |
|---------|-------------|
| `patterns` | Create patterns directory + sample |
| `checklists` | Create checklists directory + sample |
| `search` | Enable search in config |
| `validation` | Enable validation in config |
| `adapters` | Create adapters directories |
| `ci` | Create GitHub Actions workflow |
| `docker` | Create Dockerfile (future) |

## Config File

The init command creates `bek.config.json`:

```json
{
  "name": "my-project",
  "patternsDir": ".shared/production-backend-kit/patterns",
  "checklistsDir": ".shared/production-backend-kit/checklists",
  "outputDir": ".shared/production-backend-kit/db",
  "features": {
    "search": true,
    "validation": true,
    "adapters": ["claude", "cursor", "copilot", "codex"]
  },
  "logLevel": "default"
}
```
