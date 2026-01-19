---
title: "Changelog"
description: "All notable changes to this project will be documented in this file."
---

<!-- AUTO-GENERATED -->
<!-- Source: CHANGELOG.md -->



All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-01-16

### Added
- **Preset system**: `bek init --preset <name>` copies real patterns/checklists from knowledge base
- **Available presets**: `node-express`, `node-fastify`, `node-minimal`
- **60 Seconds Quickstart**: New README section with 3 copy-paste commands
- **Trust signals**: CI, CodeQL, npm version badges
- **New flags**: `--preset`, `--out` for init command

### Changed
- README restructured for faster onboarding
- npm install now primary installation method

### Fixed
- ESM path resolution in presets using `import.meta.url`

## [0.2.0] - 2026-01-16

### Changed
- **Install story**: README now uses stable `/releases/latest/download/` URL (no version hardcoding)
- **Release workflow**: Uploads both versioned and stable-named assets (`production-backend-kit.tgz`)
- **Dependencies**: Updated commander, @types/node, prettier, execa, vitest, actions/*

### Fixed
- Synced package-lock.json with Dependabot merges
- CI workflow now passes on all platforms

### Housekeeping
- Closed 11 Dependabot PRs (6 merged, 5 closed with conflicts)
- Deferred eslint 9 migration to separate PR

## [1.0.0] - 2026-01-14

### Added

#### CLI Features
- 🩺 `bek doctor` - Environment checks with JSON output support
- 🚀 `bek init` - Project initialization with 3 templates (minimal, standard, advanced)
- 🔍 `bek lint` - Content linting with 5 rules
- 📦 `bek build-db` - Build search database from markdown files
- ✅ `bek validate` - Content validation with auto-fix option
- 🔎 `bek search` - Full-text search with filters (scope, level, maturity)
- 📋 `bek list` - List all patterns and checklists
- 📄 `bek show` - Display pattern/checklist details
- 🚦 `bek gate` - Quality gate checklists for CI/CD

#### CLI Infrastructure
- Centralized logging with 4 levels (silent, default, verbose, debug)
- Global `--debug` flag for stack traces
- Global `--silent` and `--verbose` flags
- Error handling with friendly messages
- Config file support (bek.config.json, .bekrc)

#### Patterns (25)
- API: Error Model, Pagination, Versioning, Webhooks, Idempotency Keys, Request Validation
- Database: Indexing, Migrations, Transactions, N+1 Avoid, Schema Constraints, Soft Delete
- Security: Auth Boundaries, Rate Limiting, Password Storage, Secrets Management, Threat Checklist
- Reliability: Timeouts, Retries, Circuit Breaker, Outbox Pattern, DLQ Basics
- Observability: Correlation ID, Structured Logging, RED/USE Metrics

#### Checklists (5)
- API Review Checklist
- Database Review Checklist
- Security Review Checklist
- Reliability Review Checklist
- Production Readiness Checklist

#### Adapters
- Claude adapter template
- Cursor rules template
- GitHub Copilot instructions template
- Codex AGENTS.md template

#### CI/CD
- GitHub Actions CI workflow (matrix: 3 OS × 2 Node versions)
- GitHub Actions Release workflow (auto npm publish)
- Dependabot configuration

#### Documentation
- docs/architecture.md - CLI architecture
- docs/templates.md - Template system guide
- SECURITY.md - Security policy
- Updated CONTRIBUTING.md with content schema

### Changed
- Renamed CLI binary from `kit` to `bek`
- Updated package.json with new scripts (test, lint, format)

### Fixed
- Consistent exit codes across all commands

---

[Unreleased]: https://github.com/ThanhNguyxn/backend-engineering-kit/compare/v1.0.10...HEAD
[1.0.0]: https://github.com/ThanhNguyxn/backend-engineering-kit/releases/tag/v1.0.0
