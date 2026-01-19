---
title: Installation
description: How to install Backend Engineering Kit
---

# Installation

Backend Engineering Kit (BEK) is distributed as an npm package. You can install it globally or use it via npx.

## Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0

## Global Installation (Recommended)

```bash
npm install -g production-backend-kit
```

After installation, verify it works:

```bash
bek --version
# 1.0.10

bek doctor
# ✅ Node.js 22.0.0
# ✅ npm 10.0.0
# ✅ Git detected
```

## Using npx (No Installation)

You can also run BEK without installing:

```bash
npx production-backend-kit doctor
npx production-backend-kit search "rate limiting"
```

## Updating

To update to the latest version:

```bash
npm update -g production-backend-kit
```

## Troubleshooting

### Command not found

If `bek` command is not found after installation, ensure npm's global bin directory is in your PATH:

```bash
# Check npm bin directory
npm config get prefix

# Add to PATH (Linux/macOS)
export PATH="$(npm config get prefix)/bin:$PATH"

# Add to PATH (Windows PowerShell)
$env:PATH += ";$(npm config get prefix)"
```

### Permission errors

On Linux/macOS, if you get permission errors:

```bash
# Option 1: Use sudo (not recommended)
sudo npm install -g production-backend-kit

# Option 2: Change npm's default directory (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

## Next Steps

- [Quick Start](/backend-engineering-kit/guides/quickstart) - Create your first project
- [Template Gallery](/backend-engineering-kit/templates/gallery) - Browse available templates
