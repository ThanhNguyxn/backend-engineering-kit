/**
 * CLI Output Formatting - Beautiful terminal UI
 * Spinners, progress bars, tables, boxes. Respects NO_COLOR
 * 
 * @module core/ui
 */
import chalk from 'chalk';

// =============================================================================
// COLOR CONFIGURATION
// =============================================================================

/**
 * Check if colors should be disabled
 */
export function shouldUseColors(): boolean {
  // Respect NO_COLOR standard
  if (process.env.NO_COLOR !== undefined) return false;
  
  // Respect FORCE_COLOR
  if (process.env.FORCE_COLOR !== undefined) return true;
  
  // Disable in CI unless forced
  if (process.env.CI && !process.env.FORCE_COLOR) return false;
  
  // Check if stdout is a TTY
  return process.stdout.isTTY ?? false;
}

/**
 * Get chalk instance (with or without colors)
 * Note: Modern chalk auto-detects color support
 */
export function getChalk(): typeof chalk {
  // Modern chalk handles NO_COLOR automatically
  return chalk;
}

const c = getChalk();

// =============================================================================
// ICONS
// =============================================================================

export const icons = {
  // Status
  success: c.green('✓'),
  error: c.red('✖'),
  warning: c.yellow('⚠'),
  info: c.blue('ℹ'),
  
  // Actions
  arrow: c.cyan('→'),
  bullet: c.dim('•'),
  pointer: c.cyan('❯'),
  
  // Progress
  spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  progress: ['░', '▒', '▓', '█'],
  
  // Boxes
  boxTopLeft: '┌',
  boxTopRight: '┐',
  boxBottomLeft: '└',
  boxBottomRight: '┘',
  boxHorizontal: '─',
  boxVertical: '│',
  
  // Other
  star: c.yellow('★'),
  check: c.green('☑'),
  uncheck: c.dim('☐'),
  folder: c.blue('📁'),
  file: c.dim('📄'),
  package: c.cyan('📦'),
  rocket: '🚀',
  gear: '⚙️',
  magnifier: '🔍',
  hammer: '🔨',
};

// =============================================================================
// SPINNER
// =============================================================================

/**
 * Terminal spinner for async operations
 */
export class Spinner {
  private interval: NodeJS.Timeout | null = null;
  private frameIndex = 0;
  private message: string;
  private stream = process.stderr;
  
  constructor(message: string = '') {
    this.message = message;
  }
  
  /**
   * Start the spinner
   */
  start(message?: string): this {
    if (message) this.message = message;
    
    // Don't animate in non-TTY
    if (!this.stream.isTTY) {
      this.stream.write(`${this.message}...\n`);
      return this;
    }
    
    this.interval = setInterval(() => {
      const frame = icons.spinner[this.frameIndex];
      this.stream.clearLine(0);
      this.stream.cursorTo(0);
      this.stream.write(`${c.cyan(frame)} ${this.message}`);
      this.frameIndex = (this.frameIndex + 1) % icons.spinner.length;
    }, 80);
    
    return this;
  }
  
  /**
   * Update spinner message
   */
  update(message: string): this {
    this.message = message;
    return this;
  }
  
  /**
   * Stop with success
   */
  succeed(message?: string): void {
    this.stop();
    console.log(`${icons.success} ${message || this.message}`);
  }
  
  /**
   * Stop with failure
   */
  fail(message?: string): void {
    this.stop();
    console.log(`${icons.error} ${message || this.message}`);
  }
  
  /**
   * Stop with warning
   */
  warn(message?: string): void {
    this.stop();
    console.log(`${icons.warning} ${message || this.message}`);
  }
  
  /**
   * Stop with info
   */
  info(message?: string): void {
    this.stop();
    console.log(`${icons.info} ${message || this.message}`);
  }
  
  /**
   * Stop the spinner
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    if (this.stream.isTTY) {
      this.stream.clearLine(0);
      this.stream.cursorTo(0);
    }
  }
}

/**
 * Create a new spinner
 */
export function spinner(message?: string): Spinner {
  return new Spinner(message);
}

// =============================================================================
// PROGRESS BAR
// =============================================================================

export interface ProgressBarOptions {
  total: number;
  width?: number;
  complete?: string;
  incomplete?: string;
  format?: string;
}

/**
 * Terminal progress bar
 */
export class ProgressBar {
  private current = 0;
  private total: number;
  private width: number;
  private completeChar: string;
  private incompleteChar: string;
  private format: string;
  private startTime: number = Date.now();
  private stream = process.stderr;
  
  constructor(options: ProgressBarOptions) {
    this.total = options.total;
    this.width = options.width || 40;
    this.completeChar = options.complete || '█';
    this.incompleteChar = options.incomplete || '░';
    this.format = options.format || ':bar :percent :current/:total';
  }
  
  /**
   * Update progress
   */
  tick(amount: number = 1): this {
    this.current = Math.min(this.current + amount, this.total);
    this.render();
    return this;
  }
  
  /**
   * Set progress to specific value
   */
  update(current: number): this {
    this.current = Math.min(current, this.total);
    this.render();
    return this;
  }
  
  /**
   * Render the progress bar
   */
  private render(): void {
    const percent = this.current / this.total;
    const filled = Math.round(this.width * percent);
    const empty = this.width - filled;
    
    const bar = c.green(this.completeChar.repeat(filled)) + c.dim(this.incompleteChar.repeat(empty));
    const percentStr = Math.round(percent * 100) + '%';
    
    const elapsed = (Date.now() - this.startTime) / 1000;
    const eta = percent > 0 ? elapsed / percent - elapsed : 0;
    
    let output = this.format
      .replace(':bar', bar)
      .replace(':percent', percentStr.padStart(4))
      .replace(':current', String(this.current))
      .replace(':total', String(this.total))
      .replace(':elapsed', elapsed.toFixed(1) + 's')
      .replace(':eta', eta.toFixed(1) + 's');
    
    if (this.stream.isTTY) {
      this.stream.clearLine(0);
      this.stream.cursorTo(0);
      this.stream.write(output);
      
      if (this.current >= this.total) {
        this.stream.write('\n');
      }
    } else {
      // Non-TTY: just show percentage milestones
      const prevPercent = Math.floor(((this.current - 1) / this.total) * 10) * 10;
      const currPercent = Math.floor(percent * 10) * 10;
      
      if (currPercent > prevPercent || this.current >= this.total) {
        console.log(`Progress: ${percentStr}`);
      }
    }
  }
  
  /**
   * Complete the progress bar
   */
  finish(): void {
    this.update(this.total);
  }
}

/**
 * Create a new progress bar
 */
export function progressBar(total: number, options?: Partial<ProgressBarOptions>): ProgressBar {
  return new ProgressBar({ total, ...options });
}

// =============================================================================
// BOX DRAWING
// =============================================================================

export interface BoxOptions {
  title?: string;
  padding?: number;
  borderColor?: 'red' | 'green' | 'yellow' | 'blue' | 'cyan' | 'magenta' | 'white' | 'dim';
  align?: 'left' | 'center' | 'right';
  width?: number;
}

/**
 * Draw a box around text
 */
export function box(content: string | string[], options: BoxOptions = {}): string {
  const { padding = 1, borderColor = 'cyan', align = 'left', title } = options;
  
  const lines = Array.isArray(content) ? content : content.split('\n');
  
  // Calculate width
  const maxLineWidth = Math.max(...lines.map(l => stripAnsi(l).length));
  const contentWidth = options.width || maxLineWidth;
  const innerWidth = contentWidth + padding * 2;
  
  // Border character colorizer
  const colorize = borderColor === 'dim' ? c.dim : (c as any)[borderColor] || c.cyan;
  
  const result: string[] = [];
  
  // Top border
  let topBorder = colorize(icons.boxTopLeft + icons.boxHorizontal.repeat(innerWidth) + icons.boxTopRight);
  if (title) {
    const titleText = ` ${title} `;
    const titleStart = Math.floor((innerWidth - titleText.length) / 2);
    topBorder = colorize(icons.boxTopLeft) + 
      colorize(icons.boxHorizontal.repeat(titleStart)) +
      c.bold(titleText) +
      colorize(icons.boxHorizontal.repeat(innerWidth - titleStart - titleText.length)) +
      colorize(icons.boxTopRight);
  }
  result.push(topBorder);
  
  // Padding top
  for (let i = 0; i < padding; i++) {
    result.push(colorize(icons.boxVertical) + ' '.repeat(innerWidth) + colorize(icons.boxVertical));
  }
  
  // Content lines
  for (const line of lines) {
    const stripped = stripAnsi(line);
    const padAmount = contentWidth - stripped.length;
    
    let padded: string;
    switch (align) {
      case 'center':
        const left = Math.floor(padAmount / 2);
        const right = padAmount - left;
        padded = ' '.repeat(left) + line + ' '.repeat(right);
        break;
      case 'right':
        padded = ' '.repeat(padAmount) + line;
        break;
      default:
        padded = line + ' '.repeat(padAmount);
    }
    
    result.push(
      colorize(icons.boxVertical) + 
      ' '.repeat(padding) + 
      padded + 
      ' '.repeat(padding) + 
      colorize(icons.boxVertical)
    );
  }
  
  // Padding bottom
  for (let i = 0; i < padding; i++) {
    result.push(colorize(icons.boxVertical) + ' '.repeat(innerWidth) + colorize(icons.boxVertical));
  }
  
  // Bottom border
  result.push(colorize(icons.boxBottomLeft + icons.boxHorizontal.repeat(innerWidth) + icons.boxBottomRight));
  
  return result.join('\n');
}

// =============================================================================
// TABLE
// =============================================================================

export interface TableColumn {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: (value: unknown) => string;
}

export interface TableOptions {
  columns: TableColumn[];
  border?: boolean;
  headerColor?: 'cyan' | 'green' | 'yellow' | 'blue' | 'white';
}

/**
 * Render a table
 */
export function table(data: Record<string, unknown>[], options: TableOptions): string {
  const { columns, border = true, headerColor = 'cyan' } = options;
  
  // Calculate column widths
  const widths = columns.map(col => {
    if (col.width) return col.width;
    
    const headerWidth = col.header.length;
    const dataWidth = Math.max(...data.map(row => {
      const value = col.format ? col.format(row[col.key]) : String(row[col.key] ?? '');
      return stripAnsi(value).length;
    }), 0);
    
    return Math.max(headerWidth, dataWidth);
  });
  
  const colorHeader = (c as any)[headerColor] || c.cyan;
  const result: string[] = [];
  
  // Header
  if (border) {
    result.push(c.dim('┌' + widths.map(w => '─'.repeat(w + 2)).join('┬') + '┐'));
  }
  
  const headerRow = columns.map((col, i) => {
    const text = col.header.padEnd(widths[i]);
    return colorHeader(c.bold(text));
  });
  
  if (border) {
    result.push(c.dim('│') + ' ' + headerRow.join(c.dim(' │ ')) + ' ' + c.dim('│'));
    result.push(c.dim('├' + widths.map(w => '─'.repeat(w + 2)).join('┼') + '┤'));
  } else {
    result.push(headerRow.join('  '));
    result.push(c.dim('─'.repeat(widths.reduce((a, b) => a + b + 2, 0))));
  }
  
  // Data rows
  for (const row of data) {
    const cells = columns.map((col, i) => {
      const value = col.format ? col.format(row[col.key]) : String(row[col.key] ?? '');
      const stripped = stripAnsi(value);
      const padAmount = widths[i] - stripped.length;
      
      switch (col.align) {
        case 'center':
          const left = Math.floor(padAmount / 2);
          return ' '.repeat(left) + value + ' '.repeat(padAmount - left);
        case 'right':
          return ' '.repeat(padAmount) + value;
        default:
          return value + ' '.repeat(padAmount);
      }
    });
    
    if (border) {
      result.push(c.dim('│') + ' ' + cells.join(c.dim(' │ ')) + ' ' + c.dim('│'));
    } else {
      result.push(cells.join('  '));
    }
  }
  
  // Bottom border
  if (border) {
    result.push(c.dim('└' + widths.map(w => '─'.repeat(w + 2)).join('┴') + '┘'));
  }
  
  return result.join('\n');
}

// =============================================================================
// LOGGING HELPERS
// =============================================================================

export const log = {
  /**
   * Header with icon
   */
  header(text: string): void {
    console.log();
    console.log(c.bold(text));
    console.log();
  },
  
  /**
   * Success message
   */
  success(text: string): void {
    console.log(`${icons.success} ${text}`);
  },
  
  /**
   * Error message
   */
  error(text: string): void {
    console.error(`${icons.error} ${c.red(text)}`);
  },
  
  /**
   * Warning message
   */
  warn(text: string): void {
    console.log(`${icons.warning} ${c.yellow(text)}`);
  },
  
  /**
   * Info message
   */
  info(text: string): void {
    console.log(`${icons.info} ${text}`);
  },
  
  /**
   * Dimmed hint text
   */
  hint(text: string): void {
    console.log(c.dim(`  ${text}`));
  },
  
  /**
   * Labeled value
   */
  item(label: string, value: string): void {
    console.log(`  ${c.dim(label + ':')} ${value}`);
  },
  
  /**
   * Bullet list item
   */
  bullet(text: string): void {
    console.log(`  ${icons.bullet} ${text}`);
  },
  
  /**
   * Numbered list
   */
  numbered(items: string[]): void {
    items.forEach((item, i) => {
      console.log(`  ${c.dim(`${i + 1}.`)} ${item}`);
    });
  },
  
  /**
   * Newline
   */
  newline(): void {
    console.log();
  },
  
  /**
   * Horizontal rule
   */
  hr(width: number = 60): void {
    console.log(c.dim('─'.repeat(width)));
  },
  
  /**
   * JSON output
   */
  json(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Strip ANSI escape codes from string
 */
export function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  const stripped = stripAnsi(str);
  if (stripped.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Pluralize word
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || singular + 's');
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

/**
 * Format file size
 */
export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

/**
 * Highlight text with color
 */
export function highlight(text: string, pattern: string | RegExp): string {
  const regex = typeof pattern === 'string' 
    ? new RegExp(`(${pattern})`, 'gi')
    : pattern;
  
  return text.replace(regex, c.yellow('$1'));
}

/**
 * Indent text by specified amount
 */
export function indent(text: string, spaces: number = 2): string {
  const prefix = ' '.repeat(spaces);
  return text.split('\n').map(line => prefix + line).join('\n');
}

// Re-export chalk for convenience
export { c as chalk };
