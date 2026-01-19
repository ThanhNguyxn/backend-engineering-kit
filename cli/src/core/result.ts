/**
 * Result/Either Type System - Inspired by Effect-TS and Rust
 * Provides typed error handling with proper discriminated unions
 * 
 * @module core/result
 */

// =============================================================================
// CORE RESULT TYPE
// =============================================================================

/**
 * Discriminated union for success/failure results
 * Allows explicit error handling without try/catch
 */
export type Result<T, E = BekError> = 
  | { readonly _tag: 'Ok'; readonly value: T }
  | { readonly _tag: 'Err'; readonly error: E };

/**
 * Create a successful result
 */
export const Ok = <T>(value: T): Result<T, never> => ({
  _tag: 'Ok',
  value,
});

/**
 * Create a failure result
 */
export const Err = <E>(error: E): Result<never, E> => ({
  _tag: 'Err',
  error,
});

/**
 * Type guard for Ok result
 */
export const isOk = <T, E>(result: Result<T, E>): result is { _tag: 'Ok'; value: T } =>
  result._tag === 'Ok';

/**
 * Type guard for Err result
 */
export const isErr = <T, E>(result: Result<T, E>): result is { _tag: 'Err'; error: E } =>
  result._tag === 'Err';

// =============================================================================
// ERROR TYPES - Discriminated Unions for All Possible Errors
// =============================================================================

/**
 * Base error codes for all BEK errors
 */
export const ErrorCode = {
  // Config errors
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_PARSE_ERROR: 'CONFIG_PARSE_ERROR',
  
  // Pattern errors  
  PATTERN_NOT_FOUND: 'PATTERN_NOT_FOUND',
  PATTERN_ALREADY_EXISTS: 'PATTERN_ALREADY_EXISTS',
  PATTERN_VALIDATION_FAILED: 'PATTERN_VALIDATION_FAILED',
  PATTERN_DEPENDENCY_CYCLE: 'PATTERN_DEPENDENCY_CYCLE',
  PATTERN_INCOMPATIBLE: 'PATTERN_INCOMPATIBLE',
  
  // Registry errors
  REGISTRY_UNREACHABLE: 'REGISTRY_UNREACHABLE',
  REGISTRY_INVALID_RESPONSE: 'REGISTRY_INVALID_RESPONSE',
  REGISTRY_RATE_LIMITED: 'REGISTRY_RATE_LIMITED',
  REGISTRY_AUTH_FAILED: 'REGISTRY_AUTH_FAILED',
  
  // File system errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_PERMISSION_DENIED: 'FILE_PERMISSION_DENIED',
  FILE_ALREADY_EXISTS: 'FILE_ALREADY_EXISTS',
  DIR_NOT_EMPTY: 'DIR_NOT_EMPTY',
  
  // Industry errors
  INDUSTRY_NOT_FOUND: 'INDUSTRY_NOT_FOUND',
  INDUSTRY_RULES_NOT_FOUND: 'INDUSTRY_RULES_NOT_FOUND',
  
  // Environment errors
  NODE_VERSION_UNSUPPORTED: 'NODE_VERSION_UNSUPPORTED',
  MISSING_DEPENDENCY: 'MISSING_DEPENDENCY',
  
  // Validation errors
  SCHEMA_VALIDATION_FAILED: 'SCHEMA_VALIDATION_FAILED',
  FRONTMATTER_INVALID: 'FRONTMATTER_INVALID',
  
  // Generic
  UNKNOWN: 'UNKNOWN',
  CANCELLED: 'CANCELLED',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

/**
 * Recoverable errors - user can fix these
 */
export interface RecoverableError {
  readonly _type: 'recoverable';
  readonly code: ErrorCodeType;
  readonly message: string;
  readonly hint?: string;
  readonly path?: string;
  readonly details?: Record<string, unknown>;
}

/**
 * Fatal errors - bugs in BEK itself
 */
export interface FatalError {
  readonly _type: 'fatal';
  readonly code: ErrorCodeType;
  readonly message: string;
  readonly stack?: string;
  readonly cause?: Error;
}

/**
 * Aggregated errors - multiple errors collected
 */
export interface AggregatedError {
  readonly _type: 'aggregated';
  readonly errors: readonly BekError[];
  readonly message: string;
}

/**
 * Union of all possible error types
 */
export type BekError = RecoverableError | FatalError | AggregatedError;

// =============================================================================
// ERROR CONSTRUCTORS
// =============================================================================

/**
 * Create a recoverable error (user can fix)
 */
export const recoverable = (
  code: ErrorCodeType,
  message: string,
  options: { hint?: string; path?: string; details?: Record<string, unknown> } = {}
): RecoverableError => ({
  _type: 'recoverable',
  code,
  message,
  ...options,
});

/**
 * Create a fatal error (BEK bug)
 */
export const fatal = (
  code: ErrorCodeType,
  message: string,
  cause?: Error
): FatalError => ({
  _type: 'fatal',
  code,
  message,
  stack: cause?.stack,
  cause,
});

/**
 * Aggregate multiple errors into one
 */
export const aggregate = (errors: readonly BekError[]): AggregatedError => ({
  _type: 'aggregated',
  errors,
  message: `${errors.length} error(s) occurred`,
});

// =============================================================================
// SPECIFIC ERROR FACTORIES
// =============================================================================

export const Errors = {
  // Config
  configNotFound: (path: string) => recoverable(
    ErrorCode.CONFIG_NOT_FOUND,
    `Config file not found: ${path}`,
    { hint: 'Run `bek init` to create a config file', path }
  ),
  
  configInvalid: (message: string, path: string) => recoverable(
    ErrorCode.CONFIG_INVALID,
    `Invalid config: ${message}`,
    { hint: 'Check your bek.config.json syntax', path }
  ),
  
  configParseError: (path: string, details: string) => recoverable(
    ErrorCode.CONFIG_PARSE_ERROR,
    `Failed to parse config: ${details}`,
    { hint: 'Check for JSON syntax errors (missing commas, quotes)', path }
  ),
  
  // Patterns
  patternNotFound: (id: string, available: string[]) => recoverable(
    ErrorCode.PATTERN_NOT_FOUND,
    `Pattern not found: ${id}`,
    { 
      hint: available.length > 0 
        ? `Similar patterns: ${available.slice(0, 3).join(', ')}`
        : 'Run `bek list` to see available patterns',
      details: { id, available }
    }
  ),
  
  patternAlreadyExists: (id: string, path: string) => recoverable(
    ErrorCode.PATTERN_ALREADY_EXISTS,
    `Pattern already installed: ${id}`,
    { hint: 'Use --force to overwrite', path, details: { id } }
  ),
  
  patternDependencyCycle: (cycle: string[]) => recoverable(
    ErrorCode.PATTERN_DEPENDENCY_CYCLE,
    `Circular dependency detected: ${cycle.join(' → ')}`,
    { hint: 'Check pattern dependencies in registry.yaml', details: { cycle } }
  ),
  
  // Registry
  registryUnreachable: (url: string) => recoverable(
    ErrorCode.REGISTRY_UNREACHABLE,
    `Cannot reach registry: ${url}`,
    { hint: 'Check your network connection or try again later' }
  ),
  
  registryRateLimited: () => recoverable(
    ErrorCode.REGISTRY_RATE_LIMITED,
    'Registry rate limit exceeded',
    { hint: 'Wait a few minutes before trying again' }
  ),
  
  // File system
  fileNotFound: (path: string) => recoverable(
    ErrorCode.FILE_NOT_FOUND,
    `File not found: ${path}`,
    { path }
  ),
  
  filePermissionDenied: (path: string) => recoverable(
    ErrorCode.FILE_PERMISSION_DENIED,
    `Permission denied: ${path}`,
    { hint: 'Check file permissions or run with elevated privileges', path }
  ),
  
  fileAlreadyExists: (path: string) => recoverable(
    ErrorCode.FILE_ALREADY_EXISTS,
    `File already exists: ${path}`,
    { hint: 'Use --force to overwrite', path }
  ),
  
  // Industry
  industryNotFound: (id: string, available: string[]) => recoverable(
    ErrorCode.INDUSTRY_NOT_FOUND,
    `Unknown industry: ${id}`,
    { 
      hint: `Available: ${available.join(', ')}`,
      details: { id, available }
    }
  ),
  
  industryRulesNotFound: () => recoverable(
    ErrorCode.INDUSTRY_RULES_NOT_FOUND,
    'Industry rules file not found',
    { hint: 'Run `bek sync` to update your installation' }
  ),
  
  // Validation
  schemaValidationFailed: (errors: string[]) => recoverable(
    ErrorCode.SCHEMA_VALIDATION_FAILED,
    `Schema validation failed:\n  - ${errors.join('\n  - ')}`,
    { details: { errors } }
  ),
  
  frontmatterInvalid: (path: string, details: string) => recoverable(
    ErrorCode.FRONTMATTER_INVALID,
    `Invalid frontmatter in ${path}: ${details}`,
    { path, details: { reason: details } }
  ),
  
  // Environment
  nodeVersionUnsupported: (current: string, required: string) => recoverable(
    ErrorCode.NODE_VERSION_UNSUPPORTED,
    `Node.js ${required} required, found ${current}`,
    { hint: 'Update Node.js to the required version' }
  ),
  
  // Generic
  cancelled: () => recoverable(ErrorCode.CANCELLED, 'Operation cancelled by user'),
  
  unknown: (message: string, cause?: Error) => fatal(
    ErrorCode.UNKNOWN,
    message,
    cause
  ),
};

// =============================================================================
// RESULT UTILITIES
// =============================================================================

/**
 * Map over successful result value
 */
export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> => {
  if (isOk(result)) {
    return Ok(fn(result.value));
  }
  return result as Result<U, E>;
};

/**
 * FlatMap / chain operations
 */
export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result as Result<U, E>;
};

/**
 * Map over error
 */
export const mapErr = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> => {
  if (isErr(result)) {
    return Err(fn(result.error));
  }
  return Ok((result as { _tag: 'Ok'; value: T }).value);
};

/**
 * Unwrap with default value
 */
export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T => {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
};

/**
 * Get value or throw (use sparingly at boundaries)
 */
export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (isOk(result)) {
    return result.value;
  }
  const errResult = result as { _tag: 'Err'; error: E };
  throw new Error(`Unwrap failed: ${JSON.stringify(errResult.error)}`);
};

/**
 * Collect array of results - returns all errors if any fail
 */
export const collect = <T, E>(results: Result<T, E>[]): Result<T[], AggregatedError> => {
  const errors: E[] = [];
  const values: T[] = [];
  
  for (const result of results) {
    if (isErr(result)) {
      errors.push((result as { _tag: 'Err'; error: E }).error);
    } else {
      values.push((result as { _tag: 'Ok'; value: T }).value);
    }
  }
  
  if (errors.length > 0) {
    return Err(aggregate(errors as unknown as BekError[]));
  }
  
  return Ok(values);
};

/**
 * Try/catch wrapper that returns Result
 */
export const tryCatch = <T>(
  fn: () => T,
  onError: (error: unknown) => BekError
): Result<T, BekError> => {
  try {
    return Ok(fn());
  } catch (error) {
    return Err(onError(error));
  }
};

/**
 * Async try/catch wrapper
 */
export const tryCatchAsync = async <T>(
  fn: () => Promise<T>,
  onError: (error: unknown) => BekError
): Promise<Result<T, BekError>> => {
  try {
    return Ok(await fn());
  } catch (error) {
    return Err(onError(error));
  }
};

/**
 * Match on result (pattern matching)
 */
export const match = <T, E, U>(
  result: Result<T, E>,
  handlers: {
    ok: (value: T) => U;
    err: (error: E) => U;
  }
): U => {
  if (isOk(result)) {
    return handlers.ok(result.value);
  }
  return handlers.err((result as { _tag: 'Err'; error: E }).error);
};

/**
 * Execute side effect on Ok
 */
export const tap = <T, E>(
  result: Result<T, E>,
  fn: (value: T) => void
): Result<T, E> => {
  if (isOk(result)) {
    fn(result.value);
  }
  return result;
};

/**
 * Execute side effect on Err
 */
export const tapErr = <T, E>(
  result: Result<T, E>,
  fn: (error: E) => void
): Result<T, E> => {
  if (isErr(result)) {
    fn(result.error);
  }
  return result;
};

// Types are already exported as interfaces above
