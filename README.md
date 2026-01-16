# 🚀 Production Backend Kit

<div align="center">

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript)](https://www.typescriptlang.org/)

**A comprehensive knowledge base + CLI + adapters for AI-powered backend development**

[⚡ Quickstart](#-quickstart) •
[🔧 CLI Reference](#-cli-reference) •
[🔌 Adapters](#-adapters) •
[📋 Patterns](#-patterns--checklists) •
[🤝 Contributing](#-contributing)

</div>

---

## ⚡ Quickstart

### Prerequisites

- Node.js 18 or higher
- npm, yarn, or pnpm

### Installation

#### Option 1: Install from GitHub Release (recommended)

```bash
# Download and install the latest release
npm install -g https://github.com/ThanhNguyxn/backend-engineering-kit/releases/latest/download/production-backend-kit.tgz

# Verify installation
bek --version

# Check environment
bek doctor
```

#### Option 2: Install from source (for development)

```bash
# Clone the repository
git clone https://github.com/ThanhNguyxn/backend-engineering-kit.git
cd backend-engineering-kit/cli

# Install dependencies and build
npm install
npm run build

# Link globally for development
npm link

# Verify
bek --version
```

> **Note**: Once published to npm, you'll be able to install directly via:
> ```bash
> npm install -g production-backend-kit
> ```

**Expected output from `bek doctor`:**
```
🩺 Environment Check

  ✔ Operating System: win32 10.0.22631 (x64)
  ✔ Node.js: v20.10.0 (>= 18 required)
  ✔ Package Manager: npm@10.2.3
  ✔ Git: 2.43.0
  ✔ Disk Access: Writable
  ⚠ Config File: Not found (using defaults)
  ✔ Project: package.json found

⚠ Some checks have warnings. Consider addressing them.
```

### Quick Start in Your Project

```bash
# Navigate to your project
cd your-project

# Initialize with standard template
bek init --template standard -y

# Search for patterns
bek search "error handling"

# Run quality gate
bek gate --checklist checklist-api-review
```

---

## 🔧 CLI Reference

### Global Options

All commands support these global options:

| Option | Description |
|--------|-------------|
| `--debug` | Show debug output and full stack traces |
| `--silent` | Suppress all output except errors |
| `--verbose` | Show detailed verbose output |
| `--json` | Output machine-readable JSON (where supported) |

### Commands

#### `bek doctor`

Check your environment and dependencies.

```bash
bek doctor           # Human-readable output
bek doctor --json    # JSON output for CI/CD
```

**Exit codes:**
- `0` - All checks passed
- `1` - Some warnings
- `2` - Critical errors

---

#### `bek init`

Initialize a new Backend Kit project.

```bash
# Interactive mode
bek init

# Non-interactive with template
bek init --template standard -y

# Dry run (preview without creating files)
bek init --template advanced --dry-run

# Initialize with specific AI adapter
bek init --ai claude --target ./my-project
```

**Options:**
| Option | Description |
|--------|-------------|
| `-t, --template <name>` | Template: `minimal`, `standard`, `advanced` |
| `--target <path>` | Target directory (default: current) |
| `--ai <tools>` | AI adapters: `claude,cursor,copilot,codex,all` |
| `--force` | Overwrite existing files |
| `--dry-run` | Preview changes without creating files |
| `-y, --yes` | Skip prompts, use defaults |

**Templates:**
- `minimal` - Basic patterns + search
- `standard` - Patterns + checklists + validation (default)
- `advanced` - Full setup with adapters + CI/CD

---

#### `bek lint`

Lint content files for issues.

```bash
bek lint             # Human-readable output
bek lint --json      # JSON output for CI/CD
```

**Example output:**
```
🔍 Linting content...

ℹ Checked 30 files

.shared/production-backend-kit/patterns/api.error-model.md
  ⚠ Missing recommended field: scope [frontmatter-recommended]
  ⚠ Missing recommended field: maturity [frontmatter-recommended]

Found 0 errors and 90 warnings
```

---

#### `bek search <query>`

Search patterns and checklists.

```bash
# Basic search
bek search "pagination"

# With filters
bek search "authentication" --scope security
bek search "database" --level intermediate
bek search "error" --limit 5
```

**Options:**
| Option | Description |
|--------|-------------|
| `-t, --tag <tag>` | Filter by tag |
| `-s, --stack <stack>` | Filter by stack (postgresql, nodejs, etc.) |
| `-l, --level <level>` | Filter by level: beginner, intermediate, advanced |
| `--scope <scope>` | Filter by scope: api, database, security, reliability, observability |
| `-n, --limit <n>` | Limit results (default: 10) |

---

#### `bek list`

List all available patterns and checklists.

```bash
bek list                    # List all
bek list --scope security   # Filter by scope
bek list --tag api          # Filter by tag
```

---

#### `bek show <id>`

Show details of a specific pattern or checklist.

```bash
bek show api-error-model
bek show checklist-api-review --json
```

---

#### `bek gate`

Run quality gate checklist.

```bash
bek gate --checklist checklist-api-review
bek gate --checklist checklist-prod-readiness --json
```

---

#### `bek validate`

Validate content and rebuild database.

```bash
bek validate           # Validate and rebuild
bek validate --fix     # Auto-fix issues first
bek validate --json    # JSON output
```

---

#### `bek build-db`

Build/rebuild the search database.

```bash
bek build-db
```

---

## 🔌 Adapters

| Adapter | Location | Description |
|---------|----------|-------------|
| 🟣 **Claude** | `adapters/claude/` | Full skill definition with YAML frontmatter |
| 🔵 **Cursor** | `adapters/cursor/` | Rules and commands for Cursor IDE |
| ⚫ **Copilot** | `adapters/copilot/` | Custom instructions for GitHub Copilot |
| 🟢 **Codex** | `adapters/codex/` | Skill guide for OpenAI Codex |

### Manual Setup

```bash
# Claude
cp -r adapters/claude/* your-project/.claude/skills/

# Cursor
cp adapters/cursor/*.md your-project/.cursor/rules/

# Copilot
cp adapters/copilot/*.md your-project/.github/

# Codex
cp adapters/codex/*.md your-project/.codex/
```

### Using CLI

```bash
# Initialize all adapters
bek init --ai all

# Initialize specific adapter
bek init --ai claude --target ./my-project
```

---

## 📋 Patterns & Checklists

### Patterns (25+)

| Category | Patterns |
|----------|----------|
| **API** | Error Model, Pagination, Versioning, Webhooks, Idempotency |
| **Database** | Indexing, Migrations, Transactions, N+1 Avoid, Schema Constraints |
| **Security** | Auth Boundaries, Rate Limiting, Password Storage, Secrets Management |
| **Reliability** | Timeouts, Retries, Circuit Breaker, Outbox Pattern, DLQ |
| **Observability** | Correlation ID, Structured Logging, RED/USE Metrics |

### Checklists

| ID | Description |
|----|-------------|
| `checklist-api-review` | Comprehensive API review |
| `checklist-db-review` | Database schema and query review |
| `checklist-security-review` | Security controls audit |
| `checklist-reliability-review` | Resilience patterns check |
| `checklist-prod-readiness` | Pre-deployment checklist |

---

## 📁 Directory Structure

```
production-backend-kit/
├── cli/                         # CLI source (TypeScript)
│   ├── src/
│   │   ├── commands/            # doctor, init, lint
│   │   ├── lib/                 # logger, errors, config
│   │   └── __tests__/           # Unit & integration tests
│   ├── dist/                    # Compiled JavaScript
│   └── package.json
├── adapters/                    # AI tool adapters
│   ├── claude/
│   ├── cursor/
│   ├── copilot/
│   └── codex/
├── .shared/production-backend-kit/
│   ├── patterns/                # Pattern markdown files
│   ├── checklists/              # Checklist markdown files
│   └── db/                      # Generated search index
├── docs/
│   ├── architecture.md          # CLI architecture
│   └── templates.md             # Template system
├── CONTRIBUTING.md
├── CHANGELOG.md
└── SECURITY.md
```

---

## 🛠️ Development

```bash
# Clone repository
git clone https://github.com/ThanhNguyxn/backend-engineering-kit.git
cd backend-engineering-kit

# Install dependencies
cd cli
npm install

# Build
npm run build

# Run tests
npm test

# Development mode (watch)
npm run dev
```

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with ❤️ by [ThanhNguyxn](https://github.com/ThanhNguyxn)**

⭐ Star this repo if you find it helpful!

</div>
