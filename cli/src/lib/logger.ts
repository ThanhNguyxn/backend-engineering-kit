import chalk from 'chalk';

export type LogLevel = 'silent' | 'default' | 'verbose' | 'debug';

let currentLevel: LogLevel = 'default';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    silent: 0,
    default: 1,
    verbose: 2,
    debug: 3
};

export function setLogLevel(level: LogLevel): void {
    currentLevel = level;
}

export function getLogLevel(): LogLevel {
    return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[currentLevel] >= LEVEL_PRIORITY[level];
}

export const logger = {
    // Always show (errors, critical info)
    error: (message: string, ...args: unknown[]): void => {
        console.error(chalk.red('✖'), chalk.red(message), ...args);
    },

    warn: (message: string, ...args: unknown[]): void => {
        if (shouldLog('default')) {
            console.warn(chalk.yellow('⚠'), chalk.yellow(message), ...args);
        }
    },

    // Default level
    info: (message: string, ...args: unknown[]): void => {
        if (shouldLog('default')) {
            console.log(chalk.blue('ℹ'), message, ...args);
        }
    },

    success: (message: string, ...args: unknown[]): void => {
        if (shouldLog('default')) {
            console.log(chalk.green('✔'), chalk.green(message), ...args);
        }
    },

    // Verbose level
    verbose: (message: string, ...args: unknown[]): void => {
        if (shouldLog('verbose')) {
            console.log(chalk.dim('›'), chalk.dim(message), ...args);
        }
    },

    // Debug level
    debug: (message: string, ...args: unknown[]): void => {
        if (shouldLog('debug')) {
            console.log(chalk.gray('[DEBUG]'), message, ...args);
        }
    },

    // Plain output (always show, no prefix)
    log: (message: string, ...args: unknown[]): void => {
        if (shouldLog('default')) {
            console.log(message, ...args);
        }
    },

    // Newline
    newline: (): void => {
        if (shouldLog('default')) {
            console.log();
        }
    },

    // Header
    header: (message: string): void => {
        if (shouldLog('default')) {
            console.log();
            console.log(chalk.bold(message));
            console.log();
        }
    },

    // Dim text
    dim: (message: string): void => {
        if (shouldLog('default')) {
            console.log(chalk.dim(message));
        }
    },

    // Table-like output
    item: (label: string, value: string, status?: 'ok' | 'warn' | 'error'): void => {
        if (!shouldLog('default')) return;

        const icon = status === 'ok' ? chalk.green('✔')
            : status === 'warn' ? chalk.yellow('⚠')
                : status === 'error' ? chalk.red('✖')
                    : chalk.dim('›');

        console.log(`  ${icon} ${chalk.dim(label + ':')} ${value}`);
    }
};

export default logger;
