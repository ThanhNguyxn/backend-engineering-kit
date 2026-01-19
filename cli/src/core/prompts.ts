/**
 * Interactive Prompts System - Inspired by Yeoman/Inquirer
 * Memory-backed prompts with conditional flow and CI support
 * 
 * @module core/prompts
 */
import { createInterface, Interface as ReadlineInterface } from 'readline';
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { Result, Ok, Err, Errors, BekError, tryCatch, isOk } from './result.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Prompt type definitions
 */
export type PromptType = 
  | 'input'       // Free text input
  | 'password'    // Hidden input
  | 'confirm'     // Yes/no
  | 'select'      // Single selection from list
  | 'multiselect' // Multiple selection from list
  | 'autocomplete';

/**
 * Choice for selection prompts
 */
export interface PromptChoice<T = string> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

/**
 * Base prompt configuration
 */
export interface BasePromptConfig {
  name: string;
  message: string;
  default?: unknown;
  
  // Conditional display
  when?: ((answers: Record<string, unknown>) => boolean) | boolean;
  
  // Validation
  validate?: (value: unknown, answers: Record<string, unknown>) => boolean | string | Promise<boolean | string>;
  
  // Transformation
  transform?: (value: unknown, answers: Record<string, unknown>) => unknown;
  
  // Memory
  store?: boolean;  // Remember answer for next time
}

/**
 * Input prompt config
 */
export interface InputPromptConfig extends BasePromptConfig {
  type: 'input' | 'password';
  placeholder?: string;
}

/**
 * Confirm prompt config
 */
export interface ConfirmPromptConfig extends BasePromptConfig {
  type: 'confirm';
  default?: boolean;
}

/**
 * Select prompt config
 */
export interface SelectPromptConfig<T = string> extends BasePromptConfig {
  type: 'select';
  choices: Array<PromptChoice<T> | T>;
  default?: T;
}

/**
 * Multiselect prompt config
 */
export interface MultiselectPromptConfig<T = string> extends BasePromptConfig {
  type: 'multiselect';
  choices: Array<PromptChoice<T> | T>;
  default?: T[];
  min?: number;
  max?: number;
}

/**
 * Union of all prompt configs
 */
export type PromptConfig = 
  | InputPromptConfig 
  | ConfirmPromptConfig 
  | SelectPromptConfig 
  | MultiselectPromptConfig;

/**
 * Prompt result
 */
export interface PromptResult<T = unknown> {
  value: T;
  skipped: boolean;
  fromMemory: boolean;
}

// =============================================================================
// MEMORY STORE
// =============================================================================

/**
 * Persistent memory store for prompt answers
 */
class PromptMemory {
  private storePath: string;
  private data: Record<string, unknown> = {};
  
  constructor(namespace: string = 'bek') {
    this.storePath = path.join(os.homedir(), '.config', 'bek', `${namespace}-prompts.json`);
    this.load();
  }
  
  private load(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        this.data = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
      }
    } catch {
      this.data = {};
    }
  }
  
  private save(): void {
    try {
      const dir = path.dirname(this.storePath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2));
    } catch {
      // Ignore save errors
    }
  }
  
  get<T>(key: string): T | undefined {
    return this.data[key] as T | undefined;
  }
  
  set(key: string, value: unknown): void {
    this.data[key] = value;
    this.save();
  }
  
  has(key: string): boolean {
    return key in this.data;
  }
  
  delete(key: string): void {
    delete this.data[key];
    this.save();
  }
  
  clear(): void {
    this.data = {};
    this.save();
  }
  
  getAll(): Record<string, unknown> {
    return { ...this.data };
  }
}

// =============================================================================
// PROMPT ENGINE
// =============================================================================

/**
 * Interactive prompt engine with memory and CI support
 */
export class PromptEngine {
  private memory: PromptMemory;
  private ciMode: boolean = false;
  private answers: Record<string, unknown> = {};
  private rl: ReadlineInterface | null = null;
  private noColor: boolean = false;
  
  constructor(options?: {
    namespace?: string;
    ciMode?: boolean;
    noColor?: boolean;
  }) {
    this.memory = new PromptMemory(options?.namespace || 'bek');
    this.ciMode = options?.ciMode || process.env.CI === 'true' || process.env.BEK_YES === 'true';
    this.noColor = options?.noColor || process.env.NO_COLOR !== undefined;
  }
  
  /**
   * Enable CI mode (use defaults, no interaction)
   */
  enableCiMode(): void {
    this.ciMode = true;
  }
  
  /**
   * Get readline interface
   */
  private getReadline(): ReadlineInterface {
    if (!this.rl) {
      this.rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
    }
    return this.rl;
  }
  
  /**
   * Close readline interface
   */
  close(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }
  
  /**
   * Style helper
   */
  private style(text: string, styleFn: (s: string) => string): string {
    return this.noColor ? text : styleFn(text);
  }
  
  /**
   * Ask a single prompt
   */
  async prompt<T>(config: PromptConfig): Promise<PromptResult<T>> {
    // Check when condition
    if (config.when !== undefined) {
      const shouldShow = typeof config.when === 'function' 
        ? config.when(this.answers)
        : config.when;
      
      if (!shouldShow) {
        const defaultValue = config.default as T ?? ('' as unknown as T);
        return { value: defaultValue, skipped: true, fromMemory: false };
      }
    }
    
    // Check memory
    if (config.store && this.memory.has(config.name)) {
      const memorized = this.memory.get<T>(config.name);
      if (memorized !== undefined) {
        this.answers[config.name] = memorized;
        return { value: memorized, skipped: false, fromMemory: true };
      }
    }
    
    // CI mode - use default
    if (this.ciMode) {
      const defaultValue = config.default as T ?? this.getTypeDefault<T>(config.type);
      this.answers[config.name] = defaultValue;
      return { value: defaultValue, skipped: true, fromMemory: false };
    }
    
    // Interactive prompt
    let value: T;
    
    switch (config.type) {
      case 'input':
      case 'password':
        value = await this.promptInput<T>(config as InputPromptConfig);
        break;
      case 'confirm':
        value = await this.promptConfirm(config as ConfirmPromptConfig) as unknown as T;
        break;
      case 'select':
        value = await this.promptSelect<T>(config as SelectPromptConfig<T>);
        break;
      case 'multiselect':
        value = await this.promptMultiselect<T>(config as MultiselectPromptConfig<T>) as unknown as T;
        break;
      default:
        throw new Error(`Unknown prompt type: ${(config as any).type}`);
    }
    
    // Transform if needed
    if (config.transform) {
      value = config.transform(value, this.answers) as T;
    }
    
    // Validate
    if (config.validate) {
      const validation = await config.validate(value, this.answers);
      if (validation !== true) {
        const message = typeof validation === 'string' ? validation : 'Invalid input';
        console.log(this.style(`  ✗ ${message}`, chalk.red));
        return this.prompt<T>(config); // Retry
      }
    }
    
    // Store in answers
    this.answers[config.name] = value;
    
    // Store in memory if requested
    if (config.store) {
      this.memory.set(config.name, value);
    }
    
    return { value, skipped: false, fromMemory: false };
  }
  
  /**
   * Run multiple prompts in sequence
   */
  async run<T extends Record<string, unknown>>(
    configs: PromptConfig[]
  ): Promise<T> {
    for (const config of configs) {
      await this.prompt(config);
    }
    
    this.close();
    return this.answers as T;
  }
  
  /**
   * Get default value for prompt type
   */
  private getTypeDefault<T>(type: PromptType): T {
    switch (type) {
      case 'confirm':
        return false as unknown as T;
      case 'multiselect':
        return [] as unknown as T;
      default:
        return '' as unknown as T;
    }
  }
  
  /**
   * Input prompt
   */
  private async promptInput<T>(config: InputPromptConfig): Promise<T> {
    const rl = this.getReadline();
    const isPassword = config.type === 'password';
    
    let prompt = this.style('? ', chalk.green);
    prompt += this.style(config.message, chalk.bold);
    
    if (config.default !== undefined) {
      prompt += this.style(` (${config.default})`, chalk.dim);
    }
    prompt += ' ';
    
    return new Promise((resolve) => {
      if (isPassword) {
        // Password handling (hide input)
        process.stdout.write(prompt);
        
        let password = '';
        const stdin = process.stdin;
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        
        const onData = (char: string) => {
          const code = char.charCodeAt(0);
          
          if (code === 13 || code === 10) { // Enter
            stdin.setRawMode(false);
            stdin.removeListener('data', onData);
            console.log();
            resolve((password || config.default || '') as unknown as T);
          } else if (code === 127 || code === 8) { // Backspace
            if (password.length > 0) {
              password = password.slice(0, -1);
              process.stdout.write('\b \b');
            }
          } else if (code === 3) { // Ctrl+C
            process.exit(0);
          } else {
            password += char;
            process.stdout.write('*');
          }
        };
        
        stdin.on('data', onData);
      } else {
        rl.question(prompt, (answer) => {
          resolve((answer.trim() || config.default || '') as unknown as T);
        });
      }
    });
  }
  
  /**
   * Confirm prompt
   */
  private async promptConfirm(config: ConfirmPromptConfig): Promise<boolean> {
    const rl = this.getReadline();
    const defaultYes = config.default !== false;
    
    let prompt = this.style('? ', chalk.green);
    prompt += this.style(config.message, chalk.bold);
    prompt += defaultYes 
      ? this.style(' (Y/n)', chalk.dim)
      : this.style(' (y/N)', chalk.dim);
    prompt += ' ';
    
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        const normalized = answer.toLowerCase().trim();
        
        if (!normalized) {
          resolve(defaultYes);
        } else {
          resolve(normalized.startsWith('y'));
        }
      });
    });
  }
  
  /**
   * Select prompt
   */
  private async promptSelect<T>(config: SelectPromptConfig<T>): Promise<T> {
    const rl = this.getReadline();
    
    // Normalize choices to PromptChoice<T>
    const choices: Array<PromptChoice<T>> = config.choices.map(c => 
      typeof c === 'object' && c !== null && 'value' in c
        ? c as PromptChoice<T>
        : { value: c as T, label: String(c) }
    );
    
    console.log(this.style('? ', chalk.green) + this.style(config.message, chalk.bold));
    
    // Display choices
    choices.forEach((choice, idx) => {
      const isDefault = choice.value === config.default;
      const prefix = isDefault ? this.style('❯ ', chalk.cyan) : '  ';
      const label = isDefault 
        ? this.style(choice.label, chalk.cyan)
        : choice.label;
      
      let line = `  ${prefix}${idx + 1}. ${label}`;
      if (choice.hint) {
        line += this.style(` - ${choice.hint}`, chalk.dim);
      }
      
      console.log(line);
    });
    
    const defaultIdx = choices.findIndex(c => c.value === config.default);
    const defaultStr = defaultIdx >= 0 ? String(defaultIdx + 1) : '1';
    
    return new Promise((resolve) => {
      rl.question(this.style(`  Enter number [${defaultStr}]: `, chalk.dim), (answer) => {
        const idx = parseInt(answer.trim() || defaultStr, 10) - 1;
        
        if (idx >= 0 && idx < choices.length) {
          const choice = choices[idx]!;
          console.log(this.style(`  ✓ ${choice.label}`, chalk.green));
          resolve(choice.value);
        } else {
          console.log(this.style('  Invalid selection, using default', chalk.yellow));
          resolve(config.default || choices[0]!.value);
        }
      });
    });
  }
  
  /**
   * Multiselect prompt
   */
  private async promptMultiselect<T>(config: MultiselectPromptConfig<T>): Promise<T[]> {
    const rl = this.getReadline();
    
    // Normalize choices to PromptChoice<T>
    const choices: Array<PromptChoice<T>> = config.choices.map(c => 
      typeof c === 'object' && c !== null && 'value' in c
        ? c as PromptChoice<T>
        : { value: c as T, label: String(c) }
    );
    
    const defaults = config.default || [];
    
    console.log(this.style('? ', chalk.green) + this.style(config.message, chalk.bold));
    console.log(this.style('  (Enter comma-separated numbers, e.g., 1,2,3)', chalk.dim));
    
    // Display choices
    choices.forEach((choice, idx) => {
      const isDefault = defaults.includes(choice.value);
      const checkbox = isDefault 
        ? this.style('[✓]', chalk.cyan)
        : this.style('[ ]', chalk.dim);
      
      let line = `  ${checkbox} ${idx + 1}. ${choice.label}`;
      if (choice.hint) {
        line += this.style(` - ${choice.hint}`, chalk.dim);
      }
      
      console.log(line);
    });
    
    // Default selection string
    const defaultIndices = defaults
      .map(d => choices.findIndex(c => c.value === d) + 1)
      .filter(i => i > 0);
    const defaultStr = defaultIndices.length > 0 ? defaultIndices.join(',') : '';
    
    return new Promise((resolve) => {
      const prompt = defaultStr 
        ? this.style(`  Enter numbers [${defaultStr}]: `, chalk.dim)
        : this.style('  Enter numbers: ', chalk.dim);
      
      rl.question(prompt, (answer) => {
        const input = answer.trim() || defaultStr;
        
        if (!input) {
          resolve([]);
          return;
        }
        
        const indices = input
          .split(',')
          .map(s => parseInt(s.trim(), 10) - 1)
          .filter(i => i >= 0 && i < choices.length);
        
        const selected = indices.map(i => choices[i]!.value);
        
        // Validate min/max
        if (config.min !== undefined && selected.length < config.min) {
          console.log(this.style(`  ✗ Select at least ${config.min} option(s)`, chalk.red));
          return this.promptMultiselect<T>(config).then(resolve);
        }
        
        if (config.max !== undefined && selected.length > config.max) {
          console.log(this.style(`  ✗ Select at most ${config.max} option(s)`, chalk.red));
          return this.promptMultiselect<T>(config).then(resolve);
        }
        
        const selectedLabels = indices.map(i => choices[i]!.label).join(', ');
        console.log(this.style(`  ✓ ${selectedLabels || 'None'}`, chalk.green));
        
        resolve(selected);
      });
    });
  }
  
  /**
   * Get all collected answers
   */
  getAnswers(): Record<string, unknown> {
    return { ...this.answers };
  }
  
  /**
   * Set answers (for prefilling)
   */
  setAnswers(answers: Record<string, unknown>): void {
    this.answers = { ...this.answers, ...answers };
  }
  
  /**
   * Get memory store
   */
  getMemory(): Record<string, unknown> {
    return this.memory.getAll();
  }
  
  /**
   * Clear memory
   */
  clearMemory(): void {
    this.memory.clear();
  }
}

// =============================================================================
// SINGLETON & FACTORY
// =============================================================================

let globalPromptEngine: PromptEngine | null = null;

/**
 * Get global prompt engine
 */
export function getPromptEngine(): PromptEngine {
  if (!globalPromptEngine) {
    globalPromptEngine = new PromptEngine();
  }
  return globalPromptEngine;
}

/**
 * Reset prompt engine (for testing)
 */
export function resetPromptEngine(): void {
  if (globalPromptEngine) {
    globalPromptEngine.close();
  }
  globalPromptEngine = null;
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Quick input prompt
 */
export async function input(message: string, defaultValue?: string): Promise<string> {
  const engine = getPromptEngine();
  const result = await engine.prompt<string>({
    type: 'input',
    name: 'value',
    message,
    default: defaultValue,
  });
  engine.close();
  return result.value;
}

/**
 * Quick confirm prompt
 */
export async function confirm(message: string, defaultValue: boolean = true): Promise<boolean> {
  const engine = getPromptEngine();
  const result = await engine.prompt<boolean>({
    type: 'confirm',
    name: 'value',
    message,
    default: defaultValue,
  });
  engine.close();
  return result.value;
}

/**
 * Quick select prompt
 */
export async function select<T extends string = string>(
  message: string,
  choices: Array<PromptChoice<T> | T>,
  defaultValue?: T
): Promise<T> {
  const engine = getPromptEngine();
  const result = await engine.prompt<T>({
    type: 'select',
    name: 'value',
    message,
    choices: choices as Array<PromptChoice<T> | T>,
    default: defaultValue,
  } as SelectPromptConfig<T>);
  engine.close();
  return result.value;
}

/**
 * Quick multiselect prompt
 */
export async function multiselect<T extends string = string>(
  message: string,
  choices: Array<PromptChoice<T> | T>,
  defaultValue?: T[]
): Promise<T[]> {
  const engine = getPromptEngine();
  const result = await engine.prompt<T[]>({
    type: 'multiselect',
    name: 'value',
    message,
    choices: choices as Array<PromptChoice<T> | T>,
    default: defaultValue,
  } as MultiselectPromptConfig<T>);
  engine.close();
  return result.value;
}

/**
 * Quick password prompt
 */
export async function password(message: string): Promise<string> {
  const engine = getPromptEngine();
  const result = await engine.prompt<string>({
    type: 'password',
    name: 'value',
    message,
  });
  engine.close();
  return result.value;
}

// =============================================================================
// PRESET PROMPTS
// =============================================================================

/**
 * Prompt for project initialization
 */
export async function promptProjectInit(options: {
  defaults?: Partial<{
    name: string;
    template: string;
    adapters: string[];
  }>;
  ciMode?: boolean;
}): Promise<{
  name: string;
  template: string;
  adapters: string[];
  proceed: boolean;
}> {
  const engine = new PromptEngine({ ciMode: options.ciMode });
  
  return engine.run<{
    name: string;
    template: string;
    adapters: string[];
    proceed: boolean;
  }>([
    {
      type: 'input',
      name: 'name',
      message: 'Project name',
      default: options.defaults?.name || path.basename(process.cwd()),
      store: true,
    },
    {
      type: 'select',
      name: 'template',
      message: 'Select template',
      choices: [
        { value: 'minimal', label: 'Minimal', hint: 'Patterns only' },
        { value: 'standard', label: 'Standard', hint: 'Patterns + checklists' },
        { value: 'advanced', label: 'Advanced', hint: 'Full setup with CI' },
      ],
      default: options.defaults?.template || 'standard',
    },
    {
      type: 'multiselect',
      name: 'adapters',
      message: 'Select AI adapters',
      choices: [
        { value: 'claude', label: 'Claude Code' },
        { value: 'cursor', label: 'Cursor' },
        { value: 'copilot', label: 'GitHub Copilot' },
        { value: 'windsurf', label: 'Windsurf' },
        { value: 'codex', label: 'Codex CLI' },
      ],
      default: options.defaults?.adapters || ['claude', 'cursor'],
    },
    {
      type: 'confirm',
      name: 'proceed',
      message: 'Proceed with installation?',
      default: true,
    },
  ]);
}

/**
 * Prompt for pattern selection
 */
export async function promptPatternSelection(
  availablePatterns: Array<{ id: string; name: string; domain: string }>,
  options?: { ciMode?: boolean }
): Promise<string[]> {
  const engine = new PromptEngine({ ciMode: options?.ciMode });
  
  // Group patterns by domain
  const byDomain = new Map<string, Array<{ id: string; name: string }>>();
  for (const pattern of availablePatterns) {
    if (!byDomain.has(pattern.domain)) {
      byDomain.set(pattern.domain, []);
    }
    byDomain.get(pattern.domain)!.push(pattern);
  }
  
  const selected: string[] = [];
  
  for (const [domain, patterns] of byDomain) {
    const result = await engine.prompt<string[]>({
      type: 'multiselect',
      name: `patterns_${domain}`,
      message: `Select ${domain.toUpperCase()} patterns`,
      choices: patterns.map(p => ({ value: p.id, label: p.name })),
    });
    
    selected.push(...result.value);
  }
  
  engine.close();
  return selected;
}
