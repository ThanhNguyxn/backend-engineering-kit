# CLI Architecture

> Technical documentation for the Backend Engineering Kit CLI.

## Overview

The CLI is built with TypeScript and uses Commander.js for command parsing. It follows a modular architecture with clear separation of concerns.

## Directory Structure

```
cli/
├── src/
│   ├── index.ts              # Entry point, command registration
│   ├── commands/             # Command implementations
│   │   ├── doctor.ts         # Environment checks
│   │   └── init.ts           # Project initialization
│   ├── lib/                  # Shared utilities
│   │   ├── logger.ts         # Logging with levels
│   │   ├── errors.ts         # Error classes & handler
│   │   └── config.ts         # Config loader
│   ├── buildDb.ts            # Database builder
│   ├── search.ts             # Search engine
│   ├── validate-content.ts   # Content validation
│   └── normalize-content.ts  # Content normalization
├── dist/                     # Compiled output
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Key Modules

### Logger (`lib/logger.ts`)

Centralized logging with 4 levels:
- `silent` - Only errors
- `default` - Normal output
- `verbose` - Detailed output
- `debug` - All output including debug info

```typescript
import logger, { setLogLevel } from './lib/logger.js';

setLogLevel('verbose');
logger.info('Information message');
logger.debug('Debug details');
```

### Error Handling (`lib/errors.ts`)

Custom error classes with friendly messages:
- `CLIError` - Base error class
- `ConfigError` - Configuration issues
- `ValidationError` - Content validation failures
- `EnvironmentError` - System requirements not met

Stack traces only shown with `--debug` flag.

### Config (`lib/config.ts`)

Config file resolution order:
1. `bek.config.json`
2. `bek.config.js`
3. `bek.config.mjs`
4. `.bekrc`
5. `.bekrc.json`

Schema:
```typescript
interface BekConfig {
  name?: string;
  patternsDir?: string;
  checklistsDir?: string;
  outputDir?: string;
  features?: {
    search?: boolean;
    validation?: boolean;
    adapters?: string[];
  };
  logLevel?: 'silent' | 'default' | 'verbose' | 'debug';
}
```

## Command Flow

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  CLI Entry  │───▶│  Commander   │───▶│  Command    │
│  index.ts   │    │  Parse Args  │    │  Handler    │
└─────────────┘    └──────────────┘    └─────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ Global Opts  │
                   │ --debug etc  │
                   └──────────────┘
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Warning or validation error |
| 2 | Critical error (env check failed) |

## Adding New Commands

1. Create file in `src/commands/`
2. Export command function
3. Import and register in `index.ts`
4. Wrap with `wrapCommand()` for error handling

```typescript
// src/commands/my-command.ts
export async function myCommand(options: MyOptions): Promise<void> {
  // Implementation
}

// src/index.ts
import { myCommand } from './commands/my-command.js';

program
  .command('my-command')
  .action(wrapCommand(async (options) => {
    await myCommand(options);
  }));
```
