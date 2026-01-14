import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import chalk from 'chalk';
import logger from '../lib/logger.js';
import { findConfigFile } from '../lib/config.js';

interface CheckResult {
    name: string;
    status: 'ok' | 'warn' | 'error';
    message: string;
    hint?: string;
}

function checkNodeVersion(): CheckResult {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0], 10);

    if (major >= 18) {
        return { name: 'Node.js', status: 'ok', message: `${version} (>= 18 required)` };
    } else if (major >= 16) {
        return {
            name: 'Node.js',
            status: 'warn',
            message: `${version} (18+ recommended)`,
            hint: 'Consider upgrading to Node.js 18 or later'
        };
    }
    return {
        name: 'Node.js',
        status: 'error',
        message: `${version} (18+ required)`,
        hint: 'Upgrade Node.js: https://nodejs.org/'
    };
}

function checkPackageManager(): CheckResult {
    const managers: { name: string; cmd: string }[] = [
        { name: 'npm', cmd: 'npm --version' },
        { name: 'yarn', cmd: 'yarn --version' },
        { name: 'pnpm', cmd: 'pnpm --version' }
    ];

    const found: string[] = [];

    for (const { name, cmd } of managers) {
        try {
            const version = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
            found.push(`${name}@${version}`);
        } catch {
            // Not installed
        }
    }

    if (found.length === 0) {
        return {
            name: 'Package Manager',
            status: 'error',
            message: 'None found',
            hint: 'Install npm, yarn, or pnpm'
        };
    }

    return { name: 'Package Manager', status: 'ok', message: found.join(', ') };
}

function checkGit(): CheckResult {
    try {
        const version = execSync('git --version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        const match = version.match(/git version ([\d.]+)/);
        return {
            name: 'Git',
            status: 'ok',
            message: match ? match[1] : version
        };
    } catch {
        return {
            name: 'Git',
            status: 'warn',
            message: 'Not found',
            hint: 'Git is recommended for version control'
        };
    }
}

function checkOS(): CheckResult {
    const platform = os.platform();
    const release = os.release();
    const arch = os.arch();

    return {
        name: 'Operating System',
        status: 'ok',
        message: `${platform} ${release} (${arch})`
    };
}

function checkDiskSpace(): CheckResult {
    const cwd = process.cwd();

    try {
        // Simple check - just verify we can write
        const testFile = path.join(cwd, '.bek-doctor-test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);

        return { name: 'Disk Access', status: 'ok', message: 'Writable' };
    } catch {
        return {
            name: 'Disk Access',
            status: 'error',
            message: 'Cannot write to current directory',
            hint: 'Check directory permissions'
        };
    }
}

function checkConfigFile(): CheckResult {
    const configPath = findConfigFile();

    if (configPath) {
        const relativePath = path.relative(process.cwd(), configPath);
        return {
            name: 'Config File',
            status: 'ok',
            message: relativePath
        };
    }

    return {
        name: 'Config File',
        status: 'warn',
        message: 'Not found (using defaults)',
        hint: 'Run "bek init" to create a config file'
    };
}

function checkDependencies(): CheckResult {
    const cwd = process.cwd();
    const packageJsonPath = path.join(cwd, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
        return {
            name: 'Project',
            status: 'warn',
            message: 'No package.json found',
            hint: 'Run "npm init" to create a project'
        };
    }

    const nodeModulesPath = path.join(cwd, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        return {
            name: 'Dependencies',
            status: 'warn',
            message: 'node_modules not found',
            hint: 'Run "npm install" to install dependencies'
        };
    }

    return { name: 'Project', status: 'ok', message: 'package.json found' };
}

export interface DoctorOptions {
    json?: boolean;
}

export async function doctorCommand(options: DoctorOptions = {}): Promise<void> {
    const checks: CheckResult[] = [
        checkOS(),
        checkNodeVersion(),
        checkPackageManager(),
        checkGit(),
        checkDiskSpace(),
        checkConfigFile(),
        checkDependencies()
    ];

    const hasErrors = checks.some(c => c.status === 'error');
    const hasWarnings = checks.some(c => c.status === 'warn');

    if (options.json) {
        console.log(JSON.stringify({
            status: hasErrors ? 'error' : hasWarnings ? 'warn' : 'ok',
            checks
        }, null, 2));
        process.exit(hasErrors ? 2 : hasWarnings ? 1 : 0);
        return;
    }

    logger.header('🩺 Environment Check');

    for (const check of checks) {
        const icon = check.status === 'ok' ? chalk.green('✔')
            : check.status === 'warn' ? chalk.yellow('⚠')
                : chalk.red('✖');

        const statusColor = check.status === 'ok' ? chalk.green
            : check.status === 'warn' ? chalk.yellow
                : chalk.red;

        console.log(`  ${icon} ${chalk.bold(check.name)}: ${statusColor(check.message)}`);

        if (check.hint) {
            console.log(chalk.dim(`      ${check.hint}`));
        }
    }

    console.log();

    if (hasErrors) {
        logger.error('Some checks failed. Please fix the errors above.');
        process.exit(2);
    } else if (hasWarnings) {
        logger.warn('Some checks have warnings. Consider addressing them.');
        process.exit(1);
    } else {
        logger.success('All checks passed!');
        process.exit(0);
    }
}
