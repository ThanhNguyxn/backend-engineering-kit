# Legacy Assets Inventory

This document inventories all legacy assets from the original backend-engineering-kit that are preserved for backward compatibility.

## Overview

| Asset Type | Location | Count | Status |
|------------|----------|-------|--------|
| AI Adapter Templates | `adapters/templates/` | 5 | ✅ Active |
| AI Adapter Configs | `adapters/{name}/` | 4 | ✅ Active |
| Patterns | `.shared/production-backend-kit/patterns/` | 30+ | ✅ Active |
| Checklists | `.shared/production-backend-kit/checklists/` | 5 | ✅ Active |

---

## AI Adapter Templates

Location: `adapters/templates/`

| File | Purpose | CLI Usage |
|------|---------|-----------|
| `base.md` | Base template for all adapters | Internal |
| `claude.md` | Claude AI adapter prompt | `bek init --ai claude` |
| `copilot.md` | GitHub Copilot instructions | `bek init --ai copilot` |
| `cursor.md` | Cursor rules file | `bek init --ai cursor` |
| `codex.md` | OpenAI Codex prompt | `bek init --ai codex` |

### Usage

```bash
# Include single adapter
bek init --ai claude

# Include multiple adapters
bek init --ai claude,copilot,cursor

# Include all adapters
bek init --ai all
```

---

## AI Adapter Configurations

Location: `adapters/{name}/`

| Directory | Config File | Purpose |
|-----------|-------------|---------|
| `adapters/claude/` | CLAUDE.md | Claude project instructions |
| `adapters/copilot/` | instructions.md | Copilot workspace instructions |
| `adapters/cursor/` | .cursorrules | Cursor IDE rules |
| `adapters/codex/` | AGENTS.md | Codex agent config |

---

## Registry Legacy Mapping

The new Templates 2.0 registry includes a `legacyMapping` section for backward compatibility:

```yaml
# From templates/registry.yaml
legacyMapping:
  copilot: ../adapters/copilot
  cursor: ../adapters/cursor
  claude: ../adapters/claude
  codex: ../adapters/codex
```

This allows the CLI to:
1. Recognize legacy template IDs
2. Map them to the correct adapter directories
3. Maintain backward compatibility with existing workflows

---

## Migration Path

### Current (v1.0.x)
- Legacy assets remain in original locations
- `bek init` uses `--ai` flag for adapter templates
- `bek templates` uses new registry for project templates

### Future (v2.0)
- Legacy assets may be consolidated
- Deprecation warnings will be added
- Migration guide will be published

---

## Verification

To verify legacy assets are accessible:

```bash
# Check AI adapter templates
ls adapters/templates/

# Verify init works with legacy AI flag
bek init --ai copilot --dry-run

# Check new templates registry
bek templates list
```
