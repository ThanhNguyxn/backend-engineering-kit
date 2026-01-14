import chalk from 'chalk';
let currentLevel = 'default';
const LEVEL_PRIORITY = {
    silent: 0,
    default: 1,
    verbose: 2,
    debug: 3
};
export function setLogLevel(level) {
    currentLevel = level;
}
export function getLogLevel() {
    return currentLevel;
}
function shouldLog(level) {
    return LEVEL_PRIORITY[currentLevel] >= LEVEL_PRIORITY[level];
}
export const logger = {
    // Always show (errors, critical info)
    error: (message, ...args) => {
        console.error(chalk.red('✖'), chalk.red(message), ...args);
    },
    warn: (message, ...args) => {
        if (shouldLog('default')) {
            console.warn(chalk.yellow('⚠'), chalk.yellow(message), ...args);
        }
    },
    // Default level
    info: (message, ...args) => {
        if (shouldLog('default')) {
            console.log(chalk.blue('ℹ'), message, ...args);
        }
    },
    success: (message, ...args) => {
        if (shouldLog('default')) {
            console.log(chalk.green('✔'), chalk.green(message), ...args);
        }
    },
    // Verbose level
    verbose: (message, ...args) => {
        if (shouldLog('verbose')) {
            console.log(chalk.dim('›'), chalk.dim(message), ...args);
        }
    },
    // Debug level
    debug: (message, ...args) => {
        if (shouldLog('debug')) {
            console.log(chalk.gray('[DEBUG]'), message, ...args);
        }
    },
    // Plain output (always show, no prefix)
    log: (message, ...args) => {
        if (shouldLog('default')) {
            console.log(message, ...args);
        }
    },
    // Newline
    newline: () => {
        if (shouldLog('default')) {
            console.log();
        }
    },
    // Header
    header: (message) => {
        if (shouldLog('default')) {
            console.log();
            console.log(chalk.bold(message));
            console.log();
        }
    },
    // Dim text
    dim: (message) => {
        if (shouldLog('default')) {
            console.log(chalk.dim(message));
        }
    },
    // Table-like output
    item: (label, value, status) => {
        if (!shouldLog('default'))
            return;
        const icon = status === 'ok' ? chalk.green('✔')
            : status === 'warn' ? chalk.yellow('⚠')
                : status === 'error' ? chalk.red('✖')
                    : chalk.dim('›');
        console.log(`  ${icon} ${chalk.dim(label + ':')} ${value}`);
    }
};
export default logger;
//# sourceMappingURL=logger.js.map