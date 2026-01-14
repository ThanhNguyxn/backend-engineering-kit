import chalk from 'chalk';
import { getLogLevel } from './logger.js';

export class CLIError extends Error {
    constructor(
        message: string,
        public readonly code: string = 'CLI_ERROR',
        public readonly exitCode: number = 1,
        public readonly hint?: string
    ) {
        super(message);
        this.name = 'CLIError';
    }
}

export class ConfigError extends CLIError {
    constructor(message: string, hint?: string) {
        super(message, 'CONFIG_ERROR', 1, hint);
        this.name = 'ConfigError';
    }
}

export class ValidationError extends CLIError {
    constructor(message: string, hint?: string) {
        super(message, 'VALIDATION_ERROR', 1, hint);
        this.name = 'ValidationError';
    }
}

export class EnvironmentError extends CLIError {
    constructor(message: string, hint?: string) {
        super(message, 'ENV_ERROR', 2, hint);
        this.name = 'EnvironmentError';
    }
}

export function handleError(error: unknown): never {
    const isDebug = getLogLevel() === 'debug';

    if (error instanceof CLIError) {
        console.error();
        console.error(chalk.red(`✖ ${error.message}`));

        if (error.hint) {
            console.error(chalk.dim(`  Hint: ${error.hint}`));
        }

        if (isDebug && error.stack) {
            console.error();
            console.error(chalk.dim('Stack trace:'));
            console.error(chalk.dim(error.stack));
        }

        process.exit(error.exitCode);
    }

    if (error instanceof Error) {
        console.error();
        console.error(chalk.red(`✖ Unexpected error: ${error.message}`));

        if (isDebug && error.stack) {
            console.error();
            console.error(chalk.dim('Stack trace:'));
            console.error(chalk.dim(error.stack));
        } else {
            console.error(chalk.dim('  Run with --debug for more details'));
        }

        process.exit(1);
    }

    console.error(chalk.red('✖ An unknown error occurred'));
    process.exit(1);
}

export function wrapCommand<T extends (...args: any[]) => Promise<void>>(
    fn: T
): (...args: Parameters<T>) => Promise<void> {
    return async (...args: Parameters<T>): Promise<void> => {
        try {
            await fn(...args);
        } catch (error) {
            handleError(error);
        }
    };
}
