/**
 * BEK Core Module Exports
 * Central export point for all core functionality
 * 
 * @module core
 */

// Result/Error handling
export {
  // Types
  type Result,
  type BekError,
  type RecoverableError,
  type FatalError,
  type AggregatedError,
  type ErrorCodeType,
  
  // Constructors
  Ok,
  Err,
  isOk,
  isErr,
  recoverable,
  fatal,
  aggregate,
  
  // Error factories
  Errors,
  ErrorCode,
  
  // Utilities
  map,
  flatMap,
  mapErr,
  unwrap,
  unwrapOr,
  collect,
  match,
  tap,
  tapErr,
  tryCatch,
  tryCatchAsync,
} from './result.js';

// Configuration
export {
  // Types
  type BekConfig,
  type PartialBekConfig,
  type AdapterConfig,
  type RegistryConfig,
  type CacheConfig,
  
  // Functions
  loadConfig,
  createConfig,
  updateConfig,
  findConfigFile,
  findGlobalConfig,
  applyCliOverrides,
  resolvePaths,
  isInBekProject,
  getConfigPath,
  
  // Constants
  DEFAULT_CONFIG,
} from './config.js';

// Dependency Graph
export {
  // Types
  type PatternNode,
  type GraphEdge,
  type EdgeType,
  type ResolutionResult,
  
  // Classes
  DependencyGraph,
  
  // Functions
  createGraphFromRegistry,
  quickResolve,
} from './graph.js';

// Cache
export {
  // Types
  type CacheEntry,
  type CacheInputs,
  type CacheStats,
  type CacheHitResult,
  
  // Classes
  CacheManager,
  
  // Functions
  getCache,
  resetCache,
  hashString,
  hashFile,
  hashFiles,
  hashDirectory,
  createCacheKey,
  createPatternFingerprint,
  createRegistryFingerprint,
} from './cache.js';

// Hooks
export {
  // Types
  type HookEvent,
  type HookContext,
  type HookResult,
  type HookHandler,
  type HookRegistration,
  type ErrorContext,
  type InstallContext,
  type GenerateContext,
  
  // Classes
  HookManager,
  
  // Functions
  getHookManager,
  resetHookManager,
  loadConfigHooks,
  createHookContext,
  withHooks,
  registerDefaultHooks,
  
  // Built-in hooks
  createTimingHook,
  createValidationHook,
  createTelemetryHook,
  createBackupHook,
} from './hooks.js';

// Search
export {
  // Types
  type SearchDocument,
  type SearchQuery,
  type SearchResultItem,
  type SearchResponse,
  type DomainKey,
  
  // Classes
  SearchEngine,
  
  // Functions
  getSearchEngine,
  resetSearchEngine,
  quickSearch,
  parseQuery,
  detectDomain,
  getDomainInfo,
  listDomains,
  
  // Constants
  DOMAINS,
} from './search.js';

// Prompts
export {
  // Types
  type PromptType,
  type PromptChoice,
  type BasePromptConfig,
  type InputPromptConfig,
  type ConfirmPromptConfig,
  type SelectPromptConfig,
  type MultiselectPromptConfig,
  type PromptConfig,
  type PromptResult,
  
  // Classes
  PromptEngine,
  
  // Functions
  getPromptEngine,
  resetPromptEngine,
  
  // Quick prompts
  input,
  confirm,
  select,
  multiselect,
  password,
  
  // Preset prompts
  promptProjectInit,
  promptPatternSelection,
} from './prompts.js';

// Registry
export {
  // Types
  type RegistryPattern,
  type RegistryChecklist,
  type RegistryManifest,
  type RegistrySource,
  type PatternRef,
  
  // Classes
  RegistryManager,
  
  // Functions
  getRegistry,
  resetRegistry,
  parsePatternRef,
  formatPatternRef,
  loadLocalRegistry,
  buildLocalRegistry,
} from './registry.js';

// UI
export {
  // Classes
  Spinner,
  ProgressBar,
  
  // Functions
  spinner,
  progressBar,
  box,
  table,
  shouldUseColors,
  getChalk,
  stripAnsi,
  truncate,
  pluralize,
  formatDuration,
  formatSize,
  highlight,
  indent,
  
  // Objects
  icons,
  log,
  chalk,
  
  // Types
  type BoxOptions,
  type TableColumn,
  type TableOptions,
  type ProgressBarOptions,
} from './ui.js';
