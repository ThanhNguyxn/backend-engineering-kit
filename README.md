# 🚀 Production Backend Kit

<div align="center">

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Made with ❤️](https://img.shields.io/badge/Made%20with-❤️-red.svg)](https://github.com/ThanhNguyxn)
[![Claude Compatible](https://img.shields.io/badge/Claude-Compatible-blueviolet?logo=anthropic)](https://claude.ai)
[![Cursor Compatible](https://img.shields.io/badge/Cursor-Compatible-00C4B4?logo=cursor)](https://cursor.sh)
[![Copilot Compatible](https://img.shields.io/badge/Copilot-Compatible-blue?logo=github)](https://github.com/features/copilot)
[![Codex Compatible](https://img.shields.io/badge/Codex-Compatible-412991?logo=openai)](https://openai.com/codex)

**A comprehensive knowledge base + CLI + adapters for AI-powered backend development**

[📦 Quickstart](#-quickstart) •
[🔧 CLI](#-cli) •
[🔌 Adapters](#-adapters) •
[📋 Patterns](#-patterns--checklists) •
[🤝 Contributing](#-contributing)

</div>

---

## ⚡ Quickstart (60 seconds)

```bash
# Install globally
npm install -g production-backend-kit

# Check your environment
bek doctor

# Initialize in your project
cd your-project
bek init --template standard

# Search patterns
bek search "error handling"

# Run quality gate
bek gate --checklist checklist-api-review
```

## 🔧 CLI

The Backend Engineering Kit includes a powerful CLI for managing patterns, checklists, and AI adapters.

### Installation

```bash
# Global install (recommended)
npm install -g production-backend-kit

# Or use npx
npx production-backend-kit <command>
```

### Commands

| Command | Description |
|---------|-------------|
| `bek doctor` | Check environment and dependencies |
| `bek init` | Initialize a new project with templates |
| `bek lint` | Lint content files for issues |
| `bek build-db` | Build the search database |
| `bek validate` | Validate content and rebuild database |
| `bek search <query>` | Search patterns and checklists |
| `bek list` | List all available patterns/checklists |
| `bek show <id>` | Show details of a specific item |
| `bek gate` | Run quality gate checklist |

### Global Options

```bash
--debug     # Show debug output and stack traces
--silent    # Suppress all output except errors
--verbose   # Show verbose output
```

### Examples

```bash
# Initialize with advanced template
bek init --template advanced

# Search with filters
bek search "authentication" --scope security
bek search "pagination" --level intermediate

# List by scope
bek list --scope database

# Lint content
bek lint --json

# Run quality gate
bek gate --checklist checklist-prod-readiness
```

## ✨ Features

- 🎯 **Battle-tested patterns** for API design, error handling, pagination, and more
- 🔧 **Multi-AI adapters** - Works with Claude, Cursor, Copilot, and Codex
- 📋 **Ready-to-use checklists** for code reviews, API reviews, and deployments
- 🔍 **Full-text search** with MiniSearch indexing
- 🩺 **Doctor command** for environment checks
- 📊 **JSON output** for CI/CD integration

## 🔌 Adapters

| Adapter | Location | Description |
|---------|----------|-------------|
| 🟣 **Claude** | `adapters/claude/` | Full skill definition with YAML frontmatter |
| 🔵 **Cursor** | `adapters/cursor/` | Rules and commands for Cursor IDE |
| ⚫ **Copilot** | `adapters/copilot/` | Custom instructions for GitHub Copilot |
| 🟢 **Codex** | `adapters/codex/` | Skill guide for OpenAI Codex |

### Quick Setup

```bash
# Initialize all adapters
bek init --ai all

# Or specific adapter
bek init --ai claude --target ./my-project
```

## 📋 Patterns & Checklists

### Patterns (25+)

| Category | Examples |
|----------|----------|
| **API** | Error Model, Pagination, Versioning, Webhooks |
| **Database** | Indexing, Migrations, Transactions, N+1 Avoid |
| **Security** | Auth Boundaries, Rate Limiting, Password Storage |
| **Reliability** | Timeouts, Retries, Circuit Breaker, Outbox |
| **Observability** | Correlation ID, Structured Logging, Metrics |

### Checklists (5)

| Checklist | Description |
|-----------|-------------|
| `checklist-api-review` | Comprehensive API review |
| `checklist-db-review` | Database schema and query review |
| `checklist-security-review` | Security controls audit |
| `checklist-reliability-review` | Resilience patterns check |
| `checklist-prod-readiness` | Pre-deployment checklist |

## 📁 Directory Structure

```
production-backend-kit/
├── cli/                    # CLI source code
│   └── src/
│       ├── commands/       # CLI commands
│       ├── lib/            # Shared utilities
│       └── __tests__/      # Test files
├── adapters/               # AI tool adapters
│   ├── claude/
│   ├── cursor/
│   ├── copilot/
│   └── codex/
├── .shared/
│   └── production-backend-kit/
│       ├── patterns/       # Pattern files (*.md)
│       ├── checklists/     # Checklist files (*.md)
│       └── db/             # Generated search index
└── docs/                   # Documentation
```

## 🤝 Contributing

Contributions are always welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Development setup
cd cli
npm install
npm run build
npm test
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ by [ThanhNguyxn](https://github.com/ThanhNguyxn)**

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor_on_GitHub-❤️-ea4aaa?style=for-the-badge&logo=github)](https://github.com/sponsors/ThanhNguyxn)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy_Me_A_Coffee-☕-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/thanhnguyxn)

⭐ Star this repo if you find it helpful!

</div>
