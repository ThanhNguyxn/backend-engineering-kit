# 🚀 Production Backend Kit

<div align="center">

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Made with ❤️](https://img.shields.io/badge/Made%20with-❤️-red.svg)](https://github.com/ThanhNguyxn)
[![Claude Compatible](https://img.shields.io/badge/Claude-Compatible-blueviolet?logo=anthropic)](https://claude.ai)
[![Cursor Compatible](https://img.shields.io/badge/Cursor-Compatible-00C4B4?logo=cursor)](https://cursor.sh)
[![Copilot Compatible](https://img.shields.io/badge/Copilot-Compatible-blue?logo=github)](https://github.com/features/copilot)
[![Codex Compatible](https://img.shields.io/badge/Codex-Compatible-412991?logo=openai)](https://openai.com/codex)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-❤️-ea4aaa?logo=github)](https://github.com/sponsors/ThanhNguyxn)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-☕-FFDD00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/thanhnguyxn)

**A comprehensive knowledge base + CLI + adapters for AI-powered backend development**

[📚 Documentation](#-documentation) •
[🔌 Adapters](#-adapters) •
[📋 Patterns](#-patterns--checklists) •
[🤝 Contributing](#-contributing)

</div>

---

## ✨ Features

- 🎯 **Battle-tested patterns** for API design, error handling, pagination, and more
- 🔧 **Multi-AI adapters** - Works with Claude, Cursor, Copilot, and Codex
- 📋 **Ready-to-use checklists** for code reviews, API reviews, and deployments
- 🚀 **Production-ready** templates and best practices
- 📖 **Extensive documentation** with real-world examples

## 📦 Installation

### For Claude (Skills)

Copy the `adapters/claude/SKILL.md` to your `.agent/skills/` directory.

### For Cursor (Rules)

Copy `adapters/cursor/backend-kit.md` to your `.cursor/rules/` directory.

### For GitHub Copilot

Copy `adapters/copilot/copilot-instructions.md` to your `.github/` directory.

### For Codex

Copy `adapters/codex/skill.md` to your agent configuration.

## 🔌 Adapters

| Adapter | Location | Description |
|---------|----------|-------------|
| 🟣 **Claude** | `adapters/claude/SKILL.md` | Full skill definition with YAML frontmatter |
| 🔵 **Cursor** | `adapters/cursor/backend-kit.md` | Rules and commands for Cursor IDE |
| ⚫ **Copilot** | `adapters/copilot/copilot-instructions.md` | Custom instructions for GitHub Copilot |
| 🟢 **Codex** | `adapters/codex/skill.md` | Skill guide for OpenAI Codex |

## 📋 Patterns & Checklists

### 🎨 Patterns

| Pattern | Description |
|---------|-------------|
| [API Error Model](/.shared/production-backend-kit/patterns/api.error-model.md) | Standardized error response structure |
| [Pagination, Filter & Sort](/.shared/production-backend-kit/patterns/api.pagination-filter-sort.md) | RESTful pagination best practices |

### ✅ Checklists

| Checklist | Description |
|-----------|-------------|
| [API Review](/.shared/production-backend-kit/checklists/checklist.api-review.md) | Comprehensive API review checklist |

## 📚 Documentation

### Quick Start

```bash
# Clone the repository
git clone https://github.com/ThanhNguyxn/backend-engineering-kit.git

# Navigate to the directory
cd backend-engineering-kit

# Copy adapters to your project
cp -r adapters/claude/SKILL.md your-project/.agent/skills/
```

### Directory Structure

```
production-backend-kit/
├── 📄 README.md
├── 📄 LICENSE
├── 📁 adapters/
│   ├── 📁 claude/
│   │   └── 📄 SKILL.md
│   ├── 📁 cursor/
│   │   └── 📄 backend-kit.md
│   ├── 📁 copilot/
│   │   └── 📄 copilot-instructions.md
│   └── 📁 codex/
│       └── 📄 skill.md
└── 📁 .shared/
    └── 📁 production-backend-kit/
        ├── 📁 patterns/
        │   ├── 📄 api.error-model.md
        │   └── 📄 api.pagination-filter-sort.md
        └── 📁 checklists/
            └── 📄 checklist.api-review.md
```

## 🤝 Contributing

Contributions are always welcome! Please read the contribution guidelines first.

1. 🍴 Fork the repository
2. 🌿 Create your feature branch (`git checkout -b feature/amazing-feature`)
3. 💾 Commit your changes (`git commit -m 'Add some amazing feature'`)
4. 📤 Push to the branch (`git push origin feature/amazing-feature`)
5. 🔃 Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- 💜 [Anthropic](https://anthropic.com) for Claude
- 🖥️ [Cursor](https://cursor.sh) for the amazing IDE
- 🐙 [GitHub](https://github.com) for Copilot
- 🤖 [OpenAI](https://openai.com) for Codex

---

<div align="center">

**Built with ❤️ by [ThanhNguyxn](https://github.com/ThanhNguyxn)**

### 💖 Support This Project

If you find this project helpful, consider supporting it!

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor_on_GitHub-❤️-ea4aaa?style=for-the-badge&logo=github)](https://github.com/sponsors/ThanhNguyxn)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy_Me_A_Coffee-☕-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/thanhnguyxn)

⭐ Star this repo if you find it helpful!

</div>
