---
title: Add a Template
description: Guide to contributing new templates to Backend Engineering Kit
---

# Add a Template

This guide explains how to add a new project template to Backend Engineering Kit.

## Prerequisites

- Familiarity with the template's tech stack
- Working project skeleton that builds and runs
- Basic understanding of YAML

## Template Structure

Each template lives in `templates/projects/{template-id}/`:

```
templates/projects/my-template/
├── template.yaml           # Template manifest
└── skeleton/               # Project files
    ├── package.json        # or equivalent
    ├── src/
    │   └── index.ts
    ├── .env.example
    ├── .gitignore
    └── README.md
```

## Step 1: Create Template Directory

```bash
mkdir -p templates/projects/my-template/skeleton
```

## Step 2: Create template.yaml

```yaml
apiVersion: templates/v2
kind: Template

metadata:
  id: my-template
  name: "My Template Name"
  description: "Brief description of what this template provides"
  version: "1.0.0"
  maintainers: ["@your-github-handle"]

spec:
  stack: node          # node, python, go, rust, java
  level: standard      # minimal, standard, advanced
  language: typescript # typescript, python, go, etc.
  framework: express   # optional: fastify, express, django, etc.
  database: none       # none, postgresql, mongodb, mysql
  features:
    - docker
    - ci
    - healthcheck
  ports: [3000]
  difficulty: intermediate  # beginner, intermediate, advanced
  tags:
    - typescript
    - express
    - docker

  prerequisites:
    - Node.js >= 20
    - npm >= 10

  parameters:
    - name: projectName
      type: string
      description: "Name of your project"
      required: true
      pattern: "^[a-z][a-z0-9-]*$"

    - name: description
      type: string
      description: "Project description"
      default: "My awesome project"

  files:
    required:
      - package.json
      - src/index.ts
    optional:
      - Dockerfile
      - .github/workflows/ci.yml

  hooks:
    postGenerate:
      - action: npm-install
      - action: git-init
```

## Step 3: Create Skeleton Files

### Required Files

1. **Package manifest** (`package.json`, `pyproject.toml`, `go.mod`)
2. **Entry point** (`src/index.ts`, `app/main.py`, `cmd/main.go`)
3. **Environment template** (`.env.example`)
4. **Git ignore** (`.gitignore`)
5. **README** (`README.md`)

### Using Placeholders

Use `{{variable}}` for dynamic values:

```json
{
  "name": "{{projectName}}",
  "description": "{{description}}",
  "version": "0.1.0"
}
```

Available placeholders:
- `{{projectName}}` - Project name
- `{{description}}` - Project description
- `{{author}}` - Author name
- `{{port}}` - Server port

## Step 4: Register in Registry

Add to `templates/registry.yaml`:

```yaml
templates:
  # ... existing templates
  
  - id: my-template
    ref: ./projects/my-template/template.yaml
    type: project
    legacy: false
```

## Step 5: Validate

```bash
# Build CLI
cd cli && npm run build

# Validate all templates
node dist/index.js templates validate

# List templates (should include yours)
node dist/index.js templates list
```

## Step 6: Test

1. **Verify skeleton builds:**
   ```bash
   cd templates/projects/my-template/skeleton
   npm install && npm run build
   ```

2. **Test with dry-run:**
   ```bash
   bek init my-template --name test-project --dry-run
   ```

## Template Guidelines

### Do

✅ Include `.env.example` with all required variables  
✅ Include `.gitignore` appropriate for the stack  
✅ Include health check endpoint (`/health`)  
✅ Use structured logging  
✅ Add README with setup instructions  
✅ Test that the skeleton builds and runs  

### Don't

❌ Include `node_modules/`, `venv/`, or build artifacts  
❌ Include real secrets or credentials  
❌ Include large binary files  
❌ Hard-code project-specific values  

## Template Levels

| Level | Requirements |
|-------|--------------|
| **Minimal** | Entry point, package manifest |
| **Standard** | + Docker, CI, health check, logging, validation |
| **Advanced** | + Auth, database, observability, Kubernetes |

## Example Templates

Study existing templates for reference:

- **node-minimal** - Simplest Node.js starter
- **node-standard** - Production-ready Fastify
- **python-fastapi** - FastAPI with Pydantic
- **go-minimal** - Go standard library

## Need Help?

- Open an issue on GitHub
- Check existing templates for patterns
- Run `bek templates validate` for errors
