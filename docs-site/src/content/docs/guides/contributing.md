---
title: "Contributing to Production Backend Kit"
description: "First off, thanks for taking the time to contribute! 🎉"
generated: true
---

<!-- AUTO-GENERATED -->
<!-- Source: CONTRIBUTING.md -->

:::caution[Auto-generated]
This file is auto-generated from `CONTRIBUTING.md`. Do not edit directly.
:::



First off, thanks for taking the time to contribute! 🎉

## How Can I Contribute?

### 🐛 Reporting Bugs

Before creating bug reports, please check the existing issues. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples**
- **Describe the behavior you observed and what you expected**

### 💡 Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Explain why this enhancement would be useful**

---

## 📝 Content Schema

### Pattern Files

Location: `.shared/production-backend-kit/patterns/`

**Required YAML Frontmatter:**
```yaml
---
id: unique-pattern-id
title: Pattern Title
tags: [tag1, tag2]
scope: api | database | security | reliability | observability
maturity: stable | beta | alpha
works_with: [all] | [nodejs, python, go, java, etc.]
---
```

**Required Headings (in order):**
1. `## Problem` - What issue does this solve?
2. `## When to use` - Scenarios where this applies
3. `## Solution` - How to implement
4. `## Pitfalls` - Common mistakes to avoid
5. `## Checklist` - Items to verify (use `- [ ]` format)
6. `## Snippets` - Code examples (generic, not language-specific)
7. `## Sources` - References (format: `- Name — URL`)

### Checklist Files

Location: `.shared/production-backend-kit/checklists/`

**Required YAML Frontmatter:**
```yaml
---
id: checklist-unique-id
title: Checklist Title
tags: [tag1, tag2]
scope: api | database | security | reliability | deployment
maturity: stable
works_with: [all]
---
```

**Format:**
- Use `- [ ]` for checkbox items
- Group items by section with `##` headings
- Include `## Sources` at the end

---

## 🔧 Development Workflow

### Setup
```bash
cd cli
npm install
npm run build
```

### Validate Content
```bash
# Check for errors
node dist/index.js validate

# Auto-fix format issues
node dist/index.js normalize
```

### Build Database
```bash
npm run build:db
```

### Test Search
```bash
node dist/index.js search "your query"
```

---

## 🔌 Adding Adapter Support

When adding support for a new AI tool:

1. Create template in `adapters/templates/<tool>.md`
2. Run `kit render-adapters` to generate output
3. Add tool to `cli/src/index.ts` init command
4. Update the main README.md

---

## Pull Request Process

1. Fork the repo and create your branch from `main`
2. Make your changes
3. Run `npm run validate` to check content
4. Update documentation as needed
5. Submit a Pull Request

**CI will automatically:**
- Type check the CLI
- Validate all content (missing fields, duplicate IDs, missing headings)
- Build the search database

---

## Style Guide

- Use Markdown for all documentation
- Include YAML frontmatter for patterns and checklists
- Use consistent heading levels
- Sources format: `- Name — URL`
- Checklist format: `- [ ] Item description`

## Questions?

Feel free to open an issue with your question!
