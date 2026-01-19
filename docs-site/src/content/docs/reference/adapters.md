---
title: AI Adapters
description: Configuration templates for AI coding assistants
---

# AI Adapters

BEK supports **16** AI coding assistants (excluding base template).

## IDE/Editor Adapters (7)

| Adapter | File | Description |
|---------|------|-------------|
| Cursor IDE | `.cursorrules` | Rules file for Cursor AI IDE |
| Windsurf AI | `.windsurfrules` | Rules for Windsurf/Codeium AI IDE |
| Zed AI Assistant | `.zed/instructions.md` | Instructions for Zed editor AI assistant |
| Amazon Q Developer | `.amazonq/instructions.md` | Instructions for Amazon Q Developer |
| Tabnine | `.tabnine/instructions.md` | Instructions for Tabnine AI |
| Codeium | `.codeium/instructions.md` | Instructions for Codeium AI |
| Sourcegraph Cody | `.cody/instructions.md` | Instructions for Sourcegraph Cody AI |

## Extension Adapters (5)

| Adapter | File | Description |
|---------|------|-------------|
| GitHub Copilot | `.github/copilot-instructions.md` | Custom instructions for GitHub Copilot |
| Claude Code | `CLAUDE.md` | CLAUDE.md project file for Claude Code |
| OpenAI Codex/Agent | `AGENTS.md` | AGENTS.md configuration for OpenAI Codex |
| Cline AI | `.clinerules` | Rules file for Cline VS Code extension |
| Continue AI Configuration | `.continue/config.json` | Configuration for Continue VS Code/JetBrains extension |

## CLI/Terminal Adapters (4)

| Adapter | File | Description |
|---------|------|-------------|
| Aider CLI Configuration | `.aider.conf.yml` | Configuration for Aider CLI tool |
| OpenCode AI | `AGENTS.md` | Instructions for OpenCode terminal AI |
| Goose AI | `.goose/instructions.md` | Instructions for Block's Goose AI agent |
| Gemini CLI | `.gemini/context.md` | Instructions for Google Gemini CLI |

## Usage

```bash
# List all adapters
bek templates list --type adapter

# Initialize with specific adapter
bek init --ai claude
bek init --ai copilot,cursor

# Multiple adapters
bek init --ai claude,copilot,cline
```

---

*Auto-generated from `templates/registry.yaml`*
*Run `bek docs generate` to regenerate*
