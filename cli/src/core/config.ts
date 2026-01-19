/**
 * Layered Configuration System - Inspired by Nx/Turborepo
 * Supports: global (~/.bekrc) → project (.bek/config.json) → env vars → CLI args
 * 
 * @module core/config
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Result, Ok, Err, Errors, BekError, tryCatch, isOk, collect, recoverable, ErrorCode } from './result.js';

// =============================================================================
// CONFIG SCHEMA & TYPES
// =============================================================================

/**
 * AI adapter configuration
 */
export interface AdapterConfig {
  enabled: boolean;
  customPath?: string;
  template?: string;
}

/**
 * Registry configuration for namespaced pattern sources
 */
export interface RegistryConfig {
  url: string;
  namespace?: string;
  auth?: {
    type: 'token' | 'basic';
    token?: string;
  };
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  enabled: boolean;
  dir: string;
  ttl: number; // seconds
  maxSize: number; // bytes
}

/**
 * Complete BEK configuration
 */
export interface BekConfig {
  // Project identity
  name: string;
  version: string;
  
  // Schema version for migrations
  $schema?: string;
  configVersion: 1;
  
  // Paths (relative to project root)
  paths: {
    patterns: string;
    checklists: string;
    output: string;
    rules: string;
    adapters: string;
  };
  
  // Installed patterns/checklists tracking
  installed: {
    patterns: string[];
    checklists: string[];
    adapters: string[];
  };
  
  // Registry sources (supports namespaces like @acme/patterns)
  registries: Record<string, RegistryConfig>;
  
  // AI adapter configs
  adapters: Record<string, AdapterConfig>;
  
  // Industry settings
  industry?: {
    detected?: string;
    override?: string;
    confidence?: 'high' | 'medium' | 'low';
  };
  
  // Cache settings
  cache: CacheConfig;
  
  // Logging & output
  output: {
    level: 'silent' | 'normal' | 'verbose' | 'debug';
    colors: boolean;
    timestamps: boolean;
  };
  
  // Feature flags
  features: {
    search: boolean;
    validation: boolean;
    telemetry: boolean;
  };
  
  // Hooks for lifecycle events
  hooks: {
    preInstall?: string;
    postInstall?: string;
    preBuild?: string;
    postBuild?: string;
  };
}

/**
 * Partial config for user files (missing fields get defaults)
 */
export type PartialBekConfig = {
  [K in keyof BekConfig]?: BekConfig[K] extends object 
    ? Partial<BekConfig[K]> 
    : BekConfig[K];
};

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: BekConfig = {
  name: 'my-backend-project',
  version: '0.0.0',
  configVersion: 1,
  
  paths: {
    patterns: '.backend-kit/patterns',
    checklists: '.backend-kit/checklists',
    output: '.backend-kit/output',
    rules: '.backend-kit/rules',
    adapters: '.backend-kit/adapters',
  },
  
  installed: {
    patterns: [],
    checklists: [],
    adapters: [],
  },
  
  registries: {
    default: {
      url: 'https://registry.bekkit.dev',
      namespace: '@bek',
    },
  },
  
  adapters: {
    claude: { enabled: false },
    cursor: { enabled: false },
    copilot: { enabled: false },
    windsurf: { enabled: false },
    codex: { enabled: false },
  },
  
  industry: undefined,
  
  cache: {
    enabled: true,
    dir: '.backend-kit/.cache',
    ttl: 86400, // 24 hours
    maxSize: 100 * 1024 * 1024, // 100MB
  },
  
  output: {
    level: 'normal',
    colors: true,
    timestamps: false,
  },
  
  features: {
    search: true,
    validation: true,
    telemetry: false,
  },
  
  hooks: {},
};

// =============================================================================
// CONFIG FILE LOCATIONS
// =============================================================================

const CONFIG_FILES = [
  'bek.config.json',
  'bek.config.js',
  'bek.config.mjs',
  '.bekrc',
  '.bekrc.json',
  '.bek/config.json',
];

const GLOBAL_CONFIG_PATHS = [
  path.join(os.homedir(), '.bekrc'),
  path.join(os.homedir(), '.bekrc.json'),
  path.join(os.homedir(), '.config', 'bek', 'config.json'),
];

// =============================================================================
// CONFIG VALIDATION
// =============================================================================

/**
 * Validation errors collector
 */
interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

/**
 * Validate configuration object
 */
function validateConfig(config: PartialBekConfig): Result<ValidationError[], BekError> {
  const errors: ValidationError[] = [];
  
  // Validate output level
  const validLevels = ['silent', 'normal', 'verbose', 'debug'];
  if (config.output?.level && !validLevels.includes(config.output.level)) {
    errors.push({
      path: 'output.level',
      message: `Invalid level: must be one of ${validLevels.join(', ')}`,
      value: config.output.level,
    });
  }
  
  // Validate cache ttl
  if (config.cache?.ttl !== undefined && (config.cache.ttl < 0 || !Number.isInteger(config.cache.ttl))) {
    errors.push({
      path: 'cache.ttl',
      message: 'TTL must be a non-negative integer',
      value: config.cache.ttl,
    });
  }
  
  // Validate cache maxSize
  if (config.cache?.maxSize !== undefined && (config.cache.maxSize < 0 || !Number.isInteger(config.cache.maxSize))) {
    errors.push({
      path: 'cache.maxSize',
      message: 'maxSize must be a non-negative integer',
      value: config.cache.maxSize,
    });
  }
  
  // Validate registries
  if (config.registries) {
    for (const [name, registry] of Object.entries(config.registries)) {
      if (!registry) continue;
      if (!registry.url) {
        errors.push({
          path: `registries.${name}.url`,
          message: 'Registry URL is required',
        });
      } else {
        try {
          new URL(registry.url);
        } catch {
          errors.push({
            path: `registries.${name}.url`,
            message: 'Invalid URL format',
            value: registry.url,
          });
        }
      }
    }
  }
  
  // Validate paths don't escape project root
  if (config.paths) {
    for (const [key, value] of Object.entries(config.paths)) {
      if (value && (value.startsWith('/') || value.startsWith('~') || value.includes('..'))) {
        errors.push({
          path: `paths.${key}`,
          message: 'Paths must be relative and within project root',
          value,
        });
      }
    }
  }
  
  return Ok(errors);
}

// =============================================================================
// CONFIG LOADING
// =============================================================================

/**
 * Find config file in directory hierarchy
 */
export function findConfigFile(startDir: string = process.cwd()): Result<string | null, BekError> {
  let currentDir = startDir;
  const root = path.parse(currentDir).root;
  
  while (currentDir !== root) {
    for (const configFile of CONFIG_FILES) {
      const configPath = path.join(currentDir, configFile);
      if (fs.existsSync(configPath)) {
        return Ok(configPath);
      }
    }
    currentDir = path.dirname(currentDir);
  }
  
  return Ok(null);
}

/**
 * Find global config file
 */
export function findGlobalConfig(): Result<string | null, BekError> {
  for (const configPath of GLOBAL_CONFIG_PATHS) {
    if (fs.existsSync(configPath)) {
      return Ok(configPath);
    }
  }
  return Ok(null);
}

/**
 * Parse a config file
 */
async function parseConfigFile(filePath: string): Promise<Result<PartialBekConfig, BekError>> {
  const ext = path.extname(filePath);
  
  return tryCatch(
    () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      if (ext === '.json' || filePath.endsWith('.bekrc')) {
        return JSON.parse(content) as PartialBekConfig;
      }
      
      throw new Error(`Unsupported config format: ${ext}`);
    },
    (error) => {
      if (error instanceof SyntaxError) {
        return Errors.configParseError(filePath, error.message);
      }
      return Errors.configInvalid(String(error), filePath);
    }
  );
}

/**
 * Deep merge two config objects
 */
function mergeConfigs(base: BekConfig, override: PartialBekConfig): BekConfig {
  const result = { ...base };
  
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    
    const baseValue = result[key as keyof BekConfig];
    
    if (
      typeof value === 'object' && 
      value !== null && 
      !Array.isArray(value) &&
      typeof baseValue === 'object' &&
      baseValue !== null &&
      !Array.isArray(baseValue)
    ) {
      // Deep merge objects
      (result as Record<string, unknown>)[key] = { ...baseValue, ...value };
    } else {
      // Override value
      (result as Record<string, unknown>)[key] = value;
    }
  }
  
  return result;
}

/**
 * Apply environment variables to config
 */
function applyEnvOverrides(config: BekConfig): BekConfig {
  const envMappings: Record<string, (config: BekConfig, value: string) => void> = {
    BEK_LOG_LEVEL: (c, v) => {
      if (['silent', 'normal', 'verbose', 'debug'].includes(v)) {
        c.output.level = v as BekConfig['output']['level'];
      }
    },
    BEK_NO_COLOR: (c, v) => {
      c.output.colors = v !== '1' && v.toLowerCase() !== 'true';
    },
    BEK_CACHE_ENABLED: (c, v) => {
      c.cache.enabled = v === '1' || v.toLowerCase() === 'true';
    },
    BEK_TELEMETRY: (c, v) => {
      c.features.telemetry = v === '1' || v.toLowerCase() === 'true';
    },
    NO_COLOR: (c) => {
      c.output.colors = false;
    },
    FORCE_COLOR: (c) => {
      c.output.colors = true;
    },
  };
  
  for (const [envVar, applier] of Object.entries(envMappings)) {
    const value = process.env[envVar];
    if (value !== undefined) {
      applier(config, value);
    }
  }
  
  return config;
}

/**
 * Apply CLI argument overrides to config
 */
export function applyCliOverrides(
  config: BekConfig, 
  options: {
    debug?: boolean;
    silent?: boolean;
    verbose?: boolean;
    noColor?: boolean;
    force?: boolean;
  }
): BekConfig {
  const result = { ...config, output: { ...config.output } };
  
  if (options.debug) result.output.level = 'debug';
  else if (options.silent) result.output.level = 'silent';
  else if (options.verbose) result.output.level = 'verbose';
  
  if (options.noColor) result.output.colors = false;
  
  return result;
}

// =============================================================================
// MAIN CONFIG LOADER
// =============================================================================

export interface LoadConfigOptions {
  startDir?: string;
  cliOptions?: {
    debug?: boolean;
    silent?: boolean;
    verbose?: boolean;
    noColor?: boolean;
  };
  skipGlobal?: boolean;
  skipEnv?: boolean;
}

/**
 * Load configuration with full layer support
 * Priority: CLI args > env vars > project config > global config > defaults
 */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<Result<BekConfig, BekError>> {
  const { startDir = process.cwd(), cliOptions = {}, skipGlobal = false, skipEnv = false } = options;
  
  // Start with defaults
  let config: BekConfig = { ...DEFAULT_CONFIG };
  
  // Layer 1: Global config
  if (!skipGlobal) {
    const globalConfigResult = findGlobalConfig();
    if (isOk(globalConfigResult) && globalConfigResult.value) {
      const parsed = await parseConfigFile(globalConfigResult.value);
      if (isOk(parsed)) {
        config = mergeConfigs(config, parsed.value);
      }
      // Ignore global config parse errors (non-critical)
    }
  }
  
  // Layer 2: Project config
  const projectConfigResult = findConfigFile(startDir);
  if (isOk(projectConfigResult) && projectConfigResult.value) {
    const parsed = await parseConfigFile(projectConfigResult.value);
    if (!isOk(parsed)) {
      return Err((parsed as { _tag: 'Err'; error: BekError }).error);
    }
    
    // Validate project config
    const validationResult = validateConfig(parsed.value);
    if (isOk(validationResult) && validationResult.value.length > 0) {
      return Err(Errors.schemaValidationFailed(
        validationResult.value.map(e => `${e.path}: ${e.message}`)
      ));
    }
    
    config = mergeConfigs(config, parsed.value);
  }
  
  // Layer 3: Environment variables
  if (!skipEnv) {
    config = applyEnvOverrides(config);
  }
  
  // Layer 4: CLI arguments
  config = applyCliOverrides(config, cliOptions);
  
  return Ok(config);
}

// =============================================================================
// CONFIG WRITING
// =============================================================================

export interface CreateConfigOptions {
  format?: 'json' | 'js';
  minimal?: boolean;
  overwrite?: boolean;
}

/**
 * Create a new config file
 */
export function createConfig(
  targetDir: string,
  config: PartialBekConfig = {},
  options: CreateConfigOptions = {}
): Result<string, BekError> {
  const { format = 'json', minimal = false, overwrite = false } = options;
  
  const filename = format === 'json' ? 'bek.config.json' : 'bek.config.js';
  const filePath = path.join(targetDir, filename);
  
  // Check for existing file
  if (fs.existsSync(filePath) && !overwrite) {
    return Err(Errors.fileAlreadyExists(filePath));
  }
  
  // Merge with defaults
  const finalConfig = mergeConfigs(DEFAULT_CONFIG, config);
  
  // If minimal, only include non-default values
  let outputConfig: PartialBekConfig = finalConfig;
  if (minimal) {
    outputConfig = {
      name: finalConfig.name,
      version: finalConfig.version,
      configVersion: 1,
      installed: finalConfig.installed,
    };
  }
  
  return tryCatch(
    () => {
      if (format === 'json') {
        fs.writeFileSync(filePath, JSON.stringify(outputConfig, null, 2) + '\n');
      } else {
        const content = `/** @type {import('@bek/cli').BekConfig} */\nexport default ${JSON.stringify(outputConfig, null, 2)};\n`;
        fs.writeFileSync(filePath, content);
      }
      return filePath;
    },
    (error) => Errors.filePermissionDenied(filePath)
  );
}

/**
 * Update existing config file
 */
export async function updateConfig(
  filePath: string,
  updates: PartialBekConfig
): Promise<Result<void, BekError>> {
  const currentResult = await parseConfigFile(filePath);
  if (!isOk(currentResult)) {
    return currentResult as Result<void, BekError>;
  }
  
  const merged = mergeConfigs(DEFAULT_CONFIG, { ...currentResult.value, ...updates });
  
  return tryCatch(
    () => {
      fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n');
    },
    (error) => Errors.filePermissionDenied(filePath)
  );
}

// =============================================================================
// CONFIG UTILITIES
// =============================================================================

/**
 * Get resolved paths from config
 */
export function resolvePaths(config: BekConfig, baseDir: string = process.cwd()): BekConfig['paths'] & { base: string } {
  return {
    base: baseDir,
    patterns: path.resolve(baseDir, config.paths.patterns),
    checklists: path.resolve(baseDir, config.paths.checklists),
    output: path.resolve(baseDir, config.paths.output),
    rules: path.resolve(baseDir, config.paths.rules),
    adapters: path.resolve(baseDir, config.paths.adapters),
  };
}

/**
 * Check if running in a BEK project
 */
export function isInBekProject(startDir: string = process.cwd()): boolean {
  const result = findConfigFile(startDir);
  return isOk(result) && result.value !== null;
}

/**
 * Get config file path for current project
 */
export function getConfigPath(startDir: string = process.cwd()): string | null {
  const result = findConfigFile(startDir);
  return isOk(result) ? result.value : null;
}

// =============================================================================
// EXPORTS
// =============================================================================

export { DEFAULT_CONFIG };
