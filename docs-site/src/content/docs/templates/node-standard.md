---
title: Node.js Standard
description: Production-ready Node.js with Fastify, logging, Docker, and CI
---

# Node.js Standard Template

Production-ready Node.js with Fastify, structured logging, OpenAPI, Docker, and GitHub Actions CI.

## Overview

| Property | Value |
|----------|-------|
| **ID** | `node-standard` |
| **Stack** | Node.js |
| **Level** | Standard |
| **Tags** | typescript, fastify, docker, openapi, ci, logging |

## Prerequisites

- Node.js >= 20
- npm >= 10
- Docker (optional)

## Quick Start

```bash
# Create a new project
bek init node-standard --name my-api

# Navigate and install
cd my-api
npm install

# Start development
npm run dev

# Server runs at http://localhost:3000
# API docs at http://localhost:3000/docs
```

## Project Structure

```
my-api/
├── package.json
├── tsconfig.json
├── Dockerfile
├── .github/
│   └── workflows/
│       └── ci.yml
└── src/
    ├── index.ts          # Entry point
    ├── config.ts         # Environment config with Zod
    ├── logger.ts         # Pino structured logging
    └── routes/
        └── health.ts     # Health check endpoints
```

## Features

### Fastify Web Framework

Fast, low-overhead web framework with built-in validation and serialization.

```typescript
import Fastify from 'fastify';

const app = Fastify({ logger });

app.get('/api/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}));
```

### Pino Structured Logging

JSON logging in production, pretty printing in development.

```typescript
import pino from 'pino';

export const logger = pino({
  level: config.logLevel,
  transport: config.isDev ? { target: 'pino-pretty' } : undefined,
});
```

### Zod Configuration

Type-safe environment configuration with validation.

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});
```

### OpenAPI Documentation

Swagger UI automatically generated from route schemas.

```typescript
await app.register(swagger, {
  openapi: {
    info: { title: 'My API', version: '0.1.0' },
  },
});

await app.register(swaggerUi, { routePrefix: '/docs' });
```

### Docker Multi-Stage Build

Optimized production image with minimal footprint.

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### GitHub Actions CI

Automated testing, linting, and building on every push.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run production build |
| `npm run test` | Run tests with Vitest |
| `npm run lint` | Run ESLint |

## Health Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Full health check with status, uptime, version |
| `GET /api/ready` | Readiness probe for Kubernetes |
| `GET /api/live` | Liveness probe for Kubernetes |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3000` | Server port |
| `LOG_LEVEL` | `info` | Logging level |
| `CORS_ORIGIN` | `*` | CORS allowed origins |
