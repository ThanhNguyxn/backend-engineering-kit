/**
 * Lifecycle Hooks System - Inspired by Oclif
 * Event-driven hooks for pre/post operations and plugin extensibility
 * 
 * @module core/hooks
 */
import fs from 'fs';
import path from 'path';
import { Result, Ok, Err, Errors, BekError, isOk, tryCatchAsync } from './result.js';
import { BekConfig } from './config.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Available hook events
 */
export type HookEvent = 
  // Lifecycle hooks
  | 'init'              // CLI initialization
  | 'prerun'            // Before any command runs
  | 'postrun'           // After command completes
  
  // Pattern hooks
  | 'preInstall'        // Before pattern installation
  | 'postInstall'       // After pattern installation
  | 'preRemove'         // Before pattern removal
  | 'postRemove'        // After pattern removal
  
  // Build hooks
  | 'preBuild'          // Before building database
  | 'postBuild'         // After building database
  
  // Sync hooks
  | 'preSync'           // Before syncing patterns
  | 'postSync'          // After syncing patterns
  
  // Generation hooks
  | 'preGenerate'       // Before generating architecture
  | 'postGenerate'      // After generating architecture
  
  // Error hooks
  | 'onError'           // When an error occurs
  | 'onWarning'         // When a warning is emitted
  
  // Custom hooks
  | `custom:${string}`;

/**
 * Context passed to hook handlers
 */
export interface HookContext {
  event: HookEvent;
  config: BekConfig;
  cwd: string;
  args?: Record<string, unknown>;
  command?: string;
  startTime?: number;
}

/**
 * Result that can be returned from hooks
 */
export interface HookResult {
  /** Whether to continue execution */
  continue: boolean;
  /** Modified context (merged with existing) */
  context?: Partial<HookContext>;
  /** Data to pass to subsequent hooks */
  data?: Record<string, unknown>;
  /** Warnings to display */
  warnings?: string[];
}

/**
 * Hook handler function
 */
export type HookHandler = (
  context: HookContext
) => Promise<HookResult | void> | HookResult | void;

/**
 * Hook registration
 */
export interface HookRegistration {
  event: HookEvent;
  handler: HookHandler;
  priority: number;  // Higher = runs first
  source: string;    // Plugin/module name
  once?: boolean;    // Only run once then unregister
}

/**
 * Error event context
 */
export interface ErrorContext extends HookContext {
  error: BekError;
  recoverable: boolean;
}

/**
 * Install event context
 */
export interface InstallContext extends HookContext {
  patterns: string[];
  targetDir: string;
  dryRun: boolean;
}

/**
 * Generate event context
 */
export interface GenerateContext extends HookContext {
  industry: string;
  projectName: string;
  outputPath?: string;
}

// =============================================================================
// HOOK MANAGER
// =============================================================================

/**
 * Central hook manager for lifecycle events
 */
export class HookManager {
  private hooks: Map<HookEvent, HookRegistration[]> = new Map();
  private executionHistory: Array<{ event: HookEvent; timestamp: number; duration: number }> = [];
  private maxHistorySize = 100;
  
  constructor() {}
  
  /**
   * Register a hook handler
   */
  register(
    event: HookEvent,
    handler: HookHandler,
    options: {
      priority?: number;
      source?: string;
      once?: boolean;
    } = {}
  ): () => void {
    const { priority = 0, source = 'unknown', once = false } = options;
    
    const registration: HookRegistration = {
      event,
      handler,
      priority,
      source,
      once,
    };
    
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    
    const hooks = this.hooks.get(event)!;
    hooks.push(registration);
    
    // Sort by priority (descending)
    hooks.sort((a, b) => b.priority - a.priority);
    
    // Return unregister function
    return () => {
      const idx = hooks.indexOf(registration);
      if (idx !== -1) {
        hooks.splice(idx, 1);
      }
    };
  }
  
  /**
   * Register multiple hooks at once
   */
  registerMany(registrations: Array<{
    event: HookEvent;
    handler: HookHandler;
    priority?: number;
    source?: string;
  }>): () => void {
    const unregisters = registrations.map(r => 
      this.register(r.event, r.handler, { priority: r.priority, source: r.source })
    );
    
    return () => unregisters.forEach(fn => fn());
  }
  
  /**
   * Check if any hooks are registered for event
   */
  hasHooks(event: HookEvent): boolean {
    const hooks = this.hooks.get(event);
    return hooks !== undefined && hooks.length > 0;
  }
  
  /**
   * Get count of hooks for event
   */
  getHookCount(event: HookEvent): number {
    return this.hooks.get(event)?.length || 0;
  }
  
  /**
   * Execute all hooks for an event
   */
  async emit(
    event: HookEvent,
    context: HookContext
  ): Promise<Result<HookContext, BekError>> {
    const hooks = this.hooks.get(event);
    
    if (!hooks || hooks.length === 0) {
      return Ok(context);
    }
    
    const startTime = Date.now();
    let currentContext = { ...context };
    const toRemove: HookRegistration[] = [];
    
    for (const registration of hooks) {
      try {
        const result = await registration.handler(currentContext);
        
        if (result) {
          // Check if we should stop
          if (result.continue === false) {
            this.recordExecution(event, startTime);
            return Ok(currentContext);
          }
          
          // Merge context modifications
          if (result.context) {
            currentContext = { ...currentContext, ...result.context };
          }
          
          // Merge data
          if (result.data) {
            currentContext.args = { ...currentContext.args, ...result.data };
          }
        }
        
        // Mark once hooks for removal
        if (registration.once) {
          toRemove.push(registration);
        }
        
      } catch (error) {
        // If this is an error hook, don't recurse
        if (event !== 'onError') {
          await this.emitError({
            ...context,
            error: Errors.unknown(String(error), error as Error),
            recoverable: true,
          });
        }
        
        this.recordExecution(event, startTime);
        return Err(Errors.unknown(`Hook error in ${registration.source}: ${error}`, error as Error));
      }
    }
    
    // Remove once hooks
    for (const hook of toRemove) {
      const idx = hooks.indexOf(hook);
      if (idx !== -1) {
        hooks.splice(idx, 1);
      }
    }
    
    this.recordExecution(event, startTime);
    return Ok(currentContext);
  }
  
  /**
   * Emit error event
   */
  async emitError(context: ErrorContext): Promise<void> {
    await this.emit('onError', context as unknown as HookContext);
  }
  
  /**
   * Emit warning event
   */
  async emitWarning(context: HookContext & { message: string }): Promise<void> {
    await this.emit('onWarning', context);
  }
  
  /**
   * Record hook execution for metrics
   */
  private recordExecution(event: HookEvent, startTime: number): void {
    this.executionHistory.push({
      event,
      timestamp: startTime,
      duration: Date.now() - startTime,
    });
    
    // Trim history
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.shift();
    }
  }
  
  /**
   * Get execution metrics
   */
  getMetrics(): {
    totalExecutions: number;
    averageDuration: number;
    byEvent: Record<string, { count: number; avgDuration: number }>;
  } {
    const byEvent: Record<string, { count: number; totalDuration: number }> = {};
    
    for (const exec of this.executionHistory) {
      if (!byEvent[exec.event]) {
        byEvent[exec.event] = { count: 0, totalDuration: 0 };
      }
      byEvent[exec.event].count++;
      byEvent[exec.event].totalDuration += exec.duration;
    }
    
    const totalDuration = this.executionHistory.reduce((sum, e) => sum + e.duration, 0);
    
    return {
      totalExecutions: this.executionHistory.length,
      averageDuration: this.executionHistory.length > 0 
        ? totalDuration / this.executionHistory.length 
        : 0,
      byEvent: Object.fromEntries(
        Object.entries(byEvent).map(([event, data]) => [
          event,
          { count: data.count, avgDuration: data.totalDuration / data.count }
        ])
      ),
    };
  }
  
  /**
   * Clear all hooks
   */
  clear(): void {
    this.hooks.clear();
    this.executionHistory = [];
  }
  
  /**
   * Clear hooks from specific source
   */
  clearFromSource(source: string): void {
    for (const [event, hooks] of this.hooks) {
      const filtered = hooks.filter(h => h.source !== source);
      this.hooks.set(event, filtered);
    }
  }
  
  /**
   * List all registered hooks
   */
  listHooks(): Array<{ event: HookEvent; source: string; priority: number }> {
    const result: Array<{ event: HookEvent; source: string; priority: number }> = [];
    
    for (const [event, hooks] of this.hooks) {
      for (const hook of hooks) {
        result.push({
          event,
          source: hook.source,
          priority: hook.priority,
        });
      }
    }
    
    return result;
  }
}

// =============================================================================
// BUILT-IN HOOKS
// =============================================================================

/**
 * Create timing hook that logs execution time
 */
export function createTimingHook(): HookHandler {
  return async (context) => {
    const startTime = context.startTime || Date.now();
    const duration = Date.now() - startTime;
    
    if (duration > 1000) {
      console.log(`⏱️  Operation took ${(duration / 1000).toFixed(2)}s`);
    }
    
    return { continue: true };
  };
}

/**
 * Create validation hook that checks required fields
 */
export function createValidationHook(
  requiredFields: string[]
): HookHandler {
  return async (context) => {
    const missing: string[] = [];
    
    for (const field of requiredFields) {
      if (!(field in context) && !(context.args && field in context.args)) {
        missing.push(field);
      }
    }
    
    if (missing.length > 0) {
      return {
        continue: false,
        warnings: [`Missing required fields: ${missing.join(', ')}`],
      };
    }
    
    return { continue: true };
  };
}

/**
 * Create telemetry hook (respects config.features.telemetry)
 */
export function createTelemetryHook(
  reporter: (event: string, data: Record<string, unknown>) => void
): HookHandler {
  return async (context) => {
    if (!context.config.features.telemetry) {
      return { continue: true };
    }
    
    reporter(context.event, {
      command: context.command,
      timestamp: Date.now(),
      cwd: context.cwd,
    });
    
    return { continue: true };
  };
}

/**
 * Create backup hook for pre-modification operations
 */
export function createBackupHook(backupDir: string): HookHandler {
  return async (context) => {
    const targetDir = (context.args?.targetDir as string) || context.cwd;
    const backupPath = path.join(backupDir, `backup-${Date.now()}`);
    
    // Store backup path in context for potential rollback
    return {
      continue: true,
      data: { backupPath },
    };
  };
}

// =============================================================================
// HOOK HELPERS
// =============================================================================

/**
 * Load hooks from config file (hooks field)
 */
export async function loadConfigHooks(
  config: BekConfig,
  manager: HookManager
): Promise<Result<number, BekError>> {
  let loaded = 0;
  
  // Load from config.hooks
  for (const [event, scriptPath] of Object.entries(config.hooks)) {
    if (!scriptPath) continue;
    
    const fullPath = path.resolve(process.cwd(), scriptPath);
    
    if (!fs.existsSync(fullPath)) {
      continue; // Skip missing hook files
    }
    
    const result = await tryCatchAsync(
      async () => {
        const module = await import(`file://${fullPath}`);
        const handler = module.default || module.handler;
        
        if (typeof handler === 'function') {
          manager.register(event as HookEvent, handler, {
            source: `config:${event}`,
            priority: 50,
          });
          loaded++;
        }
      },
      (error) => Errors.unknown(`Failed to load hook ${event}: ${error}`, error as Error)
    );
    
    if (!isOk(result)) {
      return result as Result<number, BekError>;
    }
  }
  
  return Ok(loaded);
}

/**
 * Create context for hook emission
 */
export function createHookContext(
  event: HookEvent,
  config: BekConfig,
  args: Record<string, unknown> = {}
): HookContext {
  return {
    event,
    config,
    cwd: process.cwd(),
    args,
    startTime: Date.now(),
  };
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let globalHookManager: HookManager | null = null;

/**
 * Get global hook manager instance
 */
export function getHookManager(): HookManager {
  if (!globalHookManager) {
    globalHookManager = new HookManager();
  }
  return globalHookManager;
}

/**
 * Reset global hook manager (for testing)
 */
export function resetHookManager(): void {
  if (globalHookManager) {
    globalHookManager.clear();
  }
  globalHookManager = null;
}

// =============================================================================
// CONVENIENCE WRAPPERS
// =============================================================================

/**
 * Wrap command execution with hooks
 */
export async function withHooks<T>(
  event: HookEvent,
  config: BekConfig,
  args: Record<string, unknown>,
  fn: (context: HookContext) => Promise<T>
): Promise<Result<T, BekError>> {
  const manager = getHookManager();
  const preEvent = `pre${event.charAt(0).toUpperCase()}${event.slice(1)}` as HookEvent;
  const postEvent = `post${event.charAt(0).toUpperCase()}${event.slice(1)}` as HookEvent;
  
  let context = createHookContext(event, config, args);
  
  // Pre hook
  if (manager.hasHooks(preEvent)) {
    const preResult = await manager.emit(preEvent, context);
    if (!isOk(preResult)) {
      return preResult as Result<T, BekError>;
    }
    context = preResult.value;
  }
  
  // Main execution
  let result: T;
  try {
    result = await fn(context);
  } catch (error) {
    await manager.emitError({
      ...context,
      error: Errors.unknown(String(error), error as Error),
      recoverable: false,
    });
    return Err(Errors.unknown(String(error), error as Error));
  }
  
  // Post hook
  if (manager.hasHooks(postEvent)) {
    const postContext = { ...context, result };
    const postResult = await manager.emit(postEvent, postContext);
    if (!isOk(postResult)) {
      return postResult as Result<T, BekError>;
    }
  }
  
  return Ok(result);
}

/**
 * Register default BEK hooks
 */
export function registerDefaultHooks(manager: HookManager): void {
  // Timing hook for verbose mode
  manager.register('postrun', createTimingHook(), {
    source: 'bek:timing',
    priority: -100, // Run last
  });
}
