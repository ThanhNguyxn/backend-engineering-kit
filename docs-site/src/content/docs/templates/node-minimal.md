---
title: Node.js Minimal
description: Minimal Node.js + TypeScript starter template
---

# Node.js Minimal Template

A bare minimum Node.js starter with TypeScript and ESM modules.

## Overview

| Property | Value |
|----------|-------|
| **ID** | `node-minimal` |
| **Stack** | Node.js |
| **Level** | Minimal |
| **Tags** | typescript, esm |

## Prerequisites

- Node.js >= 20
- npm >= 10

## Quick Start

```bash
# Create a new project
bek init node-minimal --name my-app

# Navigate and install
cd my-app
npm install

# Start development
npm run dev
```

## Project Structure

```
my-app/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

## Files Included

### package.json

```json
{
  "name": "my-app",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

### src/index.ts

```typescript
console.log('Hello from my-app!');
console.log('Edit src/index.ts to get started.');
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start` | Run the compiled application |
| `npm run dev` | Start development with hot reload |

## Next Steps

After scaffolding:

1. Edit `src/index.ts` to add your logic
2. Add dependencies as needed
3. Consider upgrading to [node-standard](/backend-engineering-kit/templates/node-standard) for production features
