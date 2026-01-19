---
title: CLI Commands
description: Complete reference for Backend Engineering Kit CLI commands
---

# CLI Commands

Complete reference for all `bek` CLI commands.

## Global Options

| Option | Description |
|--------|-------------|
| `--debug` | Show debug output and stack traces |
| `--silent` | Suppress all output except errors |
| `--verbose` | Show verbose output |
| `--version` | Show version number |
| `--help` | Show help |

## Commands

### `bek doctor`

Check environment and dependencies.

```bash
bek doctor
bek doctor --json
```

### `bek init`

Initialize a new project.

```bash
# Interactive mode
bek init

# With template
bek init node-standard --name my-api

# Options
bek init [template] [options]
  --name <name>      Project name
  --target <path>    Target directory (default: .)
  --ai <adapters>    AI adapters (claude,cursor,copilot,codex,all)
  --force            Overwrite existing files
  --dry-run          Preview without creating files
  -y, --yes          Skip prompts, use defaults
```

### `bek templates list`

List available project templates.

```bash
bek templates list
bek templates list --stack node
bek templates list --level standard
bek templates list --json
```

### `bek templates validate`

Validate all templates.

```bash
bek templates validate
bek templates validate --json
```

### `bek search`

Search patterns and checklists.

```bash
bek search "error handling"
bek search "authentication" --stack nodejs
bek search "database" --level intermediate
bek search "security" --json
```

### `bek list`

List all patterns and checklists.

```bash
bek list
bek list --type pattern
bek list --type checklist
bek list --json
```

### `bek show`

Show details of a pattern or checklist.

```bash
bek show pattern-error-handling
bek show checklist-api-review --json
```

### `bek gate`

Run quality gate checklist.

```bash
bek gate --checklist checklist-api-review
bek gate --checklist checklist-prod-readiness --json
```

### `bek validate`

Validate content and rebuild database.

```bash
bek validate
bek validate --fix
bek validate --json
```

### `bek lint`

Lint content files for issues.

```bash
bek lint
bek lint --fix
bek lint --json
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error |
| 2 | Validation failed |
