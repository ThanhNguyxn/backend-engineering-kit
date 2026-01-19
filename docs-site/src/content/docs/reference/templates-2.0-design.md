---
title: "Templates 2.0 Design Specification"
description: "> **Status:** Draft  "
---

<!-- AUTO-GENERATED -->
<!-- Source: docs\templates-2.0-design.md -->



> **Status:** Draft  
> **PR:** PR-A (Research + Design Spec)  
> **Author:** Production Backend Kit Team  
> **Created:** 2026-01-17

## Overview

Transform backend-engineering-kit from simple markdown templates to a **production-grade template system** with:
- Structured registry (YAML) with schema validation
- Multi-stack project templates (Node, Python, Go)
- CLI integration with prompts and dry-run
- Auto-generated docs site with gallery

---

## Research Notes

### Sources Reviewed (12 sources)

| # | Source | Key Ideas |
|---|--------|-----------|
| 1 | **Backstage Software Templates** | YAML-based `kind: Template` with metadata, parameters (JSON Schema), steps array |
| 2 | **Backstage Scaffolder Service** | Action-based execution: `fetch:template`, `publish:github`, custom actions |
| 3 | **Cookiecutter Hooks** | `pre_gen_project` / `post_gen_project` hooks for validation and post-processing |
| 4 | **Cookiecutter Best Practices** | Python hooks for cross-platform, non-zero exit aborts generation |
| 5 | **Yeoman Generator Structure** | Priority queue run loop: prompting → configuring → writing → install |
| 6 | **Yeoman Prompts** | Type-based prompts (input/confirm/list/checkbox), validation, default values |
| 7 | **Astro Data Collections** | `type: 'data'` collections for JSON/YAML with Zod schema validation |
| 8 | **Astro Dynamic Routing** | Generate pages from data files: `[...slug].astro` |
| 9 | **Docusaurus Plugin System** | `loadContent()` + `contentLoaded()` + `addRoute()` for programmatic pages |
| 10 | **JSON Schema Validation** | `required`, `properties`, `additionalProperties: false` for strict validation |
| 11 | **JSON Schema Best Practices** | Define `$defs` for reusable types, use `oneOf`/`anyOf` for variants |
| 12 | **Template Gallery Patterns** | Card-based UI with tags/filters, detail pages with file tree preview |

### Key Design Insights

1. **Registry-first approach** (Backstage): Templates defined in YAML with typed parameters
2. **Validation hooks** (Cookiecutter): Pre-validation before generation, post-hooks for cleanup
3. **Interactive prompts** (Yeoman): Type-safe prompts with defaults and validation
4. **Data-driven docs** (Astro): Generate gallery from registry, not manual pages

---

## Template Taxonomy

### Stack Categories
```yaml
stacks:
  - node       # Node.js / TypeScript
  - python     # Python / FastAPI / Django
  - go         # Go / Gin / Echo
  - rust       # Rust / Axum / Actix
  - multi      # Polyglot / Multi-service
```

### Complexity Levels
```yaml
levels:
  - minimal    # Bare minimum boilerplate
  - standard   # Production-ready with logging, config, testing
  - advanced   # Full enterprise stack (auth, observability, CI/CD)
```

### Feature Tags
```yaml
tags:
  - docker
  - kubernetes
  - openapi
  - graphql
  - grpc
  - postgres
  - redis
  - ci-github
  - ci-gitlab
  - testing
  - logging
  - monitoring
  - authentication
```

---

## Registry Schema

### File Location
```
templates/
├── registry.yaml          # Template registry
├── schema/
│   └── registry.schema.json  # JSON Schema for validation
└── projects/
    ├── node-minimal/
    │   ├── template.yaml  # Template metadata
    │   └── skeleton/      # Template files
    ├── node-standard/
    ├── python-fastapi/
    └── go-minimal/
```

### registry.yaml Structure
```yaml
apiVersion: templates/v2
kind: Registry
metadata:
  name: production-backend-kit
  version: "2.0.0"
  
templates:
  - id: node-minimal
    ref: ./projects/node-minimal/template.yaml
    
  - id: node-standard
    ref: ./projects/node-standard/template.yaml
    
  - id: python-fastapi
    ref: ./projects/python-fastapi/template.yaml
    
  - id: go-minimal
    ref: ./projects/go-minimal/template.yaml

# Legacy mapping for backward compatibility
legacyMapping:
  copilot: adapters/copilot  # Old adapter templates
  cursor: adapters/cursor
  claude: adapters/claude
  codex: adapters/codex
```

### template.yaml Structure
```yaml
apiVersion: templates/v2
kind: Template

metadata:
  id: node-standard
  name: "Node.js Standard"
  description: "Production-ready Node.js with TypeScript, logging, OpenAPI, Docker"
  version: "1.0.0"
  author: "Production Backend Kit"

spec:
  stack: node
  level: standard
  tags:
    - typescript
    - docker
    - openapi
    - testing
    - logging
    - ci-github
    
  prerequisites:
    - Node.js >= 20
    - npm >= 10
    - Docker (optional)
    
  parameters:
    - name: projectName
      type: string
      description: "Name of your project"
      required: true
      pattern: "^[a-z][a-z0-9-]*$"
      
    - name: description
      type: string
      description: "Project description"
      default: "A production-ready backend service"
      
    - name: author
      type: string
      description: "Author name"
      
    - name: includeDocker
      type: boolean
      description: "Include Docker configuration"
      default: true
      
    - name: includeCI
      type: boolean
      description: "Include GitHub Actions CI"
      default: true
      
  files:
    required:
      - package.json
      - tsconfig.json
      - src/index.ts
    optional:
      - Dockerfile
      - docker-compose.yml
      - .github/workflows/ci.yml
      
  hooks:
    postGenerate:
      - action: npm-install
      - action: git-init
```

---

## Validation Rules

### 1. Registry Validation
- All template refs must resolve to existing `template.yaml`
- No duplicate template IDs
- Valid apiVersion

### 2. Template Metadata Validation
- Required fields: `id`, `name`, `description`, `version`
- Valid semantic version
- Stack must be in allowed list

### 3. Template Integrity Validation
- All files in `spec.files.required` must exist in `skeleton/`
- Placeholders must use consistent format: `{{projectName}}`
- No hardcoded secrets or credentials

### 4. Security Baseline
- No `eval()` or dynamic code execution in hooks
- No external network requests during generation
- Skeleton files must not contain executable scripts (except hooks)

### Exit Codes
```
0 - All validations passed
1 - Schema validation failed
2 - File integrity check failed
3 - Security policy violation
```

---

## Legacy Compatibility

### Current Templates Location
```
adapters/
├── templates/       # AI adapter templates (MD files)
│   ├── base.md
│   ├── claude.md
│   ├── codex.md
│   ├── copilot.md
│   └── cursor.md
├── claude/          # Claude-specific config
├── codex/
├── copilot/
└── cursor/
```

### Migration Strategy

1. **Phase 1 (PR-B):** Keep legacy in place, add new `templates/` directory
2. **Phase 2 (PR-C):** Add `--legacy` flag to CLI for old behavior
3. **Phase 3 (Future):** Deprecation notice, migration guide

### ID Mapping
```yaml
legacyMapping:
  # Old CLI command → New template ID
  "init copilot": adapters/copilot
  "init cursor": adapters/cursor
  
  # Auto-detect and suggest migration
  migrationHint: "Consider using 'bek init node-standard' for full project scaffolding"
```

---

## CLI Integration

### New Commands / Options

```bash
# List available templates
bek templates list
bek templates list --stack node --level standard

# Init with new templates (interactive)
bek init
# → Select template from registry
# → Answer prompts
# → Generate project

# Init with specific template
bek init node-standard --name my-project

# Dry run (preview only)
bek init node-standard --dry-run

# Validate registry and templates
bek validate --templates
bek validate --templates --json

# Legacy mode (backward compatible)
bek init --legacy copilot
```

### Interactive Prompts Flow
```
$ bek init

? Select a template:
  ❯ node-minimal     - Minimal Node.js starter
    node-standard    - Production-ready with Docker, CI
    python-fastapi   - FastAPI with OpenAPI
    go-minimal       - Minimal Go service

? Project name: my-awesome-api
? Description: My backend service
? Include Docker configuration? (Y/n) 
? Include GitHub Actions CI? (Y/n)

Creating project...
✓ Generated 15 files
✓ Installed dependencies
✓ Initialized git repository

Next steps:
  cd my-awesome-api
  npm run dev
```

---

## Roadmap

### PR-A: Research + Design Spec ✅
- [x] Research Backstage, Cookiecutter, Yeoman
- [x] Research docs site generation (Astro/Docusaurus)
- [x] Design registry schema
- [x] Define validation rules
- [x] Plan legacy compatibility

### PR-B: Registry + Templates + Validation + CLI
- [ ] Create `templates/` directory structure
- [ ] Implement registry schema (JSON Schema)
- [ ] Create 4 new templates:
  - [ ] node-minimal
  - [ ] node-standard
  - [ ] python-fastapi-minimal
  - [ ] go-minimal
- [ ] Implement validator (`bek validate --templates`)
- [ ] Integrate with `bek init`
- [ ] Unit tests for schema/validator
- [ ] E2E tests for init --dry-run

### PR-C: Docs Site / Gallery
- [ ] Choose framework (Astro Starlight recommended)
- [ ] Auto-generate template cards from registry
- [ ] Template detail pages with file tree
- [ ] Search/filter UI
- [ ] Deploy to GitHub Pages
- [ ] Update README with docs link

---

## Open Questions

1. **Hook execution language:** TypeScript or shell scripts?
2. **Template file format:** Handlebars, Mustache, or custom `{{placeholder}}`?
3. **Remote templates:** Support `bek init https://github.com/...`?

---

## Appendix: JSON Schema (Draft)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://backend-kit.dev/schemas/template.schema.json",
  "title": "Template",
  "type": "object",
  "required": ["apiVersion", "kind", "metadata", "spec"],
  "properties": {
    "apiVersion": {
      "type": "string",
      "const": "templates/v2"
    },
    "kind": {
      "type": "string",
      "const": "Template"
    },
    "metadata": {
      "type": "object",
      "required": ["id", "name", "description", "version"],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9-]*$"
        },
        "name": { "type": "string" },
        "description": { "type": "string" },
        "version": {
          "type": "string",
          "pattern": "^\\d+\\.\\d+\\.\\d+$"
        }
      }
    },
    "spec": {
      "type": "object",
      "required": ["stack", "level"],
      "properties": {
        "stack": {
          "type": "string",
          "enum": ["node", "python", "go", "rust", "multi"]
        },
        "level": {
          "type": "string",
          "enum": ["minimal", "standard", "advanced"]
        },
        "tags": {
          "type": "array",
          "items": { "type": "string" }
        },
        "parameters": {
          "type": "array",
          "items": { "$ref": "#/$defs/parameter" }
        }
      }
    }
  },
  "$defs": {
    "parameter": {
      "type": "object",
      "required": ["name", "type"],
      "properties": {
        "name": { "type": "string" },
        "type": {
          "type": "string",
          "enum": ["string", "boolean", "number", "choice"]
        },
        "description": { "type": "string" },
        "required": { "type": "boolean" },
        "default": {},
        "pattern": { "type": "string" }
      }
    }
  }
}
```
