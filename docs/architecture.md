# CLI Architecture

> Technical documentation for the Backend Engineering Kit CLI.

## Overview

The CLI is built with **TypeScript** and uses **Commander.js** for command parsing. It follows a modular architecture with clear separation of concerns.

**Key technologies:**
- Node.js 18+
- TypeScript 5.x (ESM modules)
- Commander.js 12.x
- MiniSearch for full-text search
- Vitest for testing

## Directory Structure

```
cli/
├── src/
│   ├── index.ts              # Entry point, command registration
│   ├── commands/             # Command implementations
│   │   ├── doctor.ts         # Environment checks
│   │   ├── init.ts           # Project initialization
│   │   └── lint.ts           # Content linting
│   ├── lib/                  # Shared utilities
│   │   ├── logger.ts         # Logging with 4 levels
│   │   ├── errors.ts         # Error classes & handler
│   │   └── config.ts         # Config loader & validation
│   ├── buildDb.ts            # Search database builder
│   ├── search.ts             # Search engine (MiniSearch)
│   ├── validate-content.ts   # Content validation
│   └── normalize-content.ts  # Content normalization/auto-fix
├── __tests__/                # Test files
│   ├── config.test.ts
│   ├── doctor.test.ts
│   ├── init.test.ts
│   └── cli.integration.test.ts
├── dist/                     # Compiled JavaScript output
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Key Modules

### Logger (`lib/logger.ts`)

Centralized logging with 4 levels:

| Level | Description |
|-------|-------------|
| `silent` | Only errors |
| `default` | Normal output (info, success, warn) |
| `verbose` | Detailed output |
| `debug` | All output including internal debug info |

**Usage:**
```typescript
import logger, { setLogLevel } from './lib/logger.js';

setLogLevel('verbose');
logger.info('Information message');
logger.success('Operation completed');
logger.warn('Warning message');
logger.error('Error message');
logger.debug('Debug details');
logger.verbose('Verbose info');
```

**Methods:**
- `logger.info(msg)` - Blue info icon
- `logger.success(msg)` - Green success icon
- `logger.warn(msg)` - Yellow warning icon
- `logger.error(msg)` - Red error icon
- `logger.debug(msg)` - Gray debug prefix
- `logger.verbose(msg)` - Dim verbose output
- `logger.header(msg)` - Bold header with spacing
- `logger.item(label, value, status?)` - Key-value with optional status icon

### Error Handling (`lib/errors.ts`)

Custom error classes with friendly messages:

| Class | Use Case |
|-------|----------|
| `CLIError` | Base error class |
| `ConfigError` | Configuration file issues |
| `ValidationError` | Content validation failures |
| `EnvironmentError` | System requirements not met |

**Key features:**
- Stack traces only shown with `--debug` flag
- `wrapCommand()` wrapper for consistent error handling
- Exit codes based on error type

**Usage:**
```typescript
import { CLIError, wrapCommand } from './lib/errors.js';

// Throw a CLI error
throw new CLIError('Something went wrong', 'ERROR_CODE', 1, 'Try this instead');

// Wrap command for automatic error handling
program
  .command('my-cmd')
  .action(wrapCommand(async (options) => {
    // Your code here
  }));
```

### Config (`lib/config.ts`)

Config file resolution order (first found wins):
1. `bek.config.json`
2. `bek.config.js`
3. `bek.config.mjs`
4. `.bekrc`
5. `.bekrc.json`

**Schema:**
```typescript
interface BekConfig {
  name?: string;           // Project name
  version?: string;        // Project version
  patternsDir?: string;    // Path to patterns
  checklistsDir?: string;  // Path to checklists
  outputDir?: string;      // Path for generated DB
  features?: {
    search?: boolean;      // Enable search
    validation?: boolean;  // Enable validation
    adapters?: string[];   // Enabled adapters
  };
  logLevel?: 'silent' | 'default' | 'verbose' | 'debug';
}
```

**Functions:**
- `findConfigFile(startDir)` - Find config file in directory tree
- `loadConfig(path?)` - Load and validate config
- `validateConfig(config)` - Validate config schema
- `createConfigFile(dir, config, format)` - Create new config file

## Command Flow

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  CLI Entry  │───▶│  Commander   │───▶│  Command    │
│  index.ts   │    │  Parse Args  │    │  Handler    │
└─────────────┘    └──────────────┘    └─────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ preAction    │
                   │ Hook         │
                   │ (set log     │
                   │  level)      │
                   └──────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ wrapCommand  │
                   │ (error       │
                   │  handling)   │
                   └──────────────┘
```

## Exit Codes

| Code | Meaning | Example |
|------|---------|---------|
| 0 | Success | All operations completed |
| 1 | Warning or non-critical error | Doctor found warnings, lint found issues |
| 2 | Critical error | Missing required files, invalid config |

## Global Options

All commands inherit these options from the root program:

| Option | Effect |
|--------|--------|
| `--debug` | Set log level to debug, show stack traces |
| `--silent` | Set log level to silent |
| `--verbose` | Set log level to verbose |

## Adding New Commands

### Step 1: Create command file

```typescript
// src/commands/my-command.ts
import logger from '../lib/logger.js';
import { CLIError } from '../lib/errors.js';

export interface MyCommandOptions {
  json?: boolean;
  force?: boolean;
}

export async function myCommand(options: MyCommandOptions): Promise<void> {
  logger.header('🚀 My Command');
  
  // Your implementation
  
  if (options.json) {
    console.log(JSON.stringify({ success: true }));
    return;
  }
  
  logger.success('Done!');
}
```

### Step 2: Register in index.ts

```typescript
import { myCommand } from './commands/my-command.js';
import { wrapCommand } from './lib/errors.js';

program
  .command('my-command')
  .description('Description of my command')
  .option('--json', 'Output as JSON')
  .option('--force', 'Force operation')
  .action(wrapCommand(async (options) => {
    await myCommand(options);
  }));
```

### Step 3: Add tests

```typescript
// src/__tests__/my-command.test.ts
import { describe, it, expect } from 'vitest';

describe('My Command', () => {
  it('should do something', async () => {
    // Test implementation
  });
});
```

## Testing

Run tests:
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

Test types:
- **Unit tests**: Test individual functions
- **Integration tests**: Test CLI commands via child_process
