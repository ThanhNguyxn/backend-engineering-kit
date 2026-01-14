# Contributing to Production Backend Kit

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

### 📝 Adding New Patterns

1. Create a new file in `.shared/production-backend-kit/patterns/`
2. Use the YAML frontmatter format:
   ```yaml
   ---
   title: Your Pattern Title
   description: Brief description
   category: patterns
   tags:
     - relevant
     - tags
   version: 1.0.0
   ---
   ```
3. Include examples in multiple languages where applicable
4. Add best practices and anti-patterns sections

### ✅ Adding New Checklists

1. Create a new file in `.shared/production-backend-kit/checklists/`
2. Use checkbox format: `- [ ] Item`
3. Group items by category
4. Include quick reference sections

### 🔌 Adding Adapter Support

When adding support for a new AI tool:

1. Create a new directory in `adapters/`
2. Follow the format of existing adapters
3. Include references to shared patterns
4. Update the main README.md

## Pull Request Process

1. Fork the repo and create your branch from `main`
2. Make your changes
3. Update documentation as needed
4. Submit a Pull Request

## Style Guide

- Use Markdown for all documentation
- Include YAML frontmatter for patterns and checklists
- Use consistent heading levels
- Include code examples where applicable

## Questions?

Feel free to open an issue with your question!
