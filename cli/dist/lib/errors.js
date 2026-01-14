import chalk from 'chalk';
import { getLogLevel } from './logger.js';
export class CLIError extends Error {
    code;
    exitCode;
    hint;
    constructor(message, code = 'CLI_ERROR', exitCode = 1, hint) {
        super(message);
        this.code = code;
        this.exitCode = exitCode;
        this.hint = hint;
        this.name = 'CLIError';
    }
}
export class ConfigError extends CLIError {
    constructor(message, hint) {
        super(message, 'CONFIG_ERROR', 1, hint);
        this.name = 'ConfigError';
    }
}
export class ValidationError extends CLIError {
    constructor(message, hint) {
        super(message, 'VALIDATION_ERROR', 1, hint);
        this.name = 'ValidationError';
    }
}
export class EnvironmentError extends CLIError {
    constructor(message, hint) {
        super(message, 'ENV_ERROR', 2, hint);
        this.name = 'EnvironmentError';
    }
}
export function handleError(error) {
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
        }
        else {
            console.error(chalk.dim('  Run with --debug for more details'));
        }
        process.exit(1);
    }
    console.error(chalk.red('✖ An unknown error occurred'));
    process.exit(1);
}
export function wrapCommand(fn) {
    return async (...args) => {
        try {
            await fn(...args);
        }
        catch (error) {
            handleError(error);
        }
    };
}
//# sourceMappingURL=errors.js.map