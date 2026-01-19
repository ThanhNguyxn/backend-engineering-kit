/**
 * bek sync command
 * Updates BEK-generated files in an existing project
 */
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import logger from '../lib/logger.js';
import { CLIError } from '../lib/errors.js';
import {
    loadManifest,
    saveManifest,
    hasBackendKit,
    getCliVersion,
    BACKEND_KIT_DIR,
    BekManifest,
} from '../lib/manifest.js';
import { getPreset, copyPresetFiles } from '../lib/presets.js';

export interface SyncOptions {
    target?: string;
    dryRun?: boolean;
    force?: boolean;
    backup?: boolean;
    json?: boolean;
}

interface SyncResult {
    added: string[];
    updated: string[];
    removed: string[];
    unchanged: string[];
    backupPath?: string;
}

/**
 * Create a backup of the current .backend-kit directory
 */
function createBackup(targetDir: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(targetDir, BACKEND_KIT_DIR, '.backup', timestamp);
    const sourceDir = path.join(targetDir, BACKEND_KIT_DIR);

    // Copy all files except .backup folder
    fs.mkdirSync(backupDir, { recursive: true });

    function copyDir(src: string, dest: string) {
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === '.backup') continue;
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                fs.mkdirSync(destPath, { recursive: true });
                copyDir(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    copyDir(sourceDir, backupDir);
    return backupDir;
}

/**
 * Get all files in a directory recursively
 */
function getAllFiles(dir: string, basePath = ''): string[] {
    const files: string[] = [];
    if (!fs.existsSync(dir)) return files;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const relativePath = path.join(basePath, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== '.backup' && entry.name !== 'node_modules') {
                files.push(...getAllFiles(path.join(dir, entry.name), relativePath));
            }
        } else {
            files.push(relativePath);
        }
    }
    return files;
}

/**
 * Sync command implementation
 */
export async function syncCommand(options: SyncOptions = {}): Promise<void> {
    const target = path.resolve(options.target || '.');
    const dryRun = options.dryRun ?? false;
    const force = options.force ?? false;
    const backup = options.backup ?? true;
    const json = options.json ?? false;

    if (!json) {
        logger.header('🔄 Syncing Backend Kit');
    }

    // Check if project has BEK installed
    if (!hasBackendKit(target)) {
        throw new CLIError(
            'No Backend Kit found in this directory',
            'NO_BACKEND_KIT',
            1,
            'Run `bek init --preset <preset>` to initialize first'
        );
    }

    // Load manifest
    const manifest = loadManifest(target);
    if (!manifest) {
        throw new CLIError(
            'No manifest found. This project may have been initialized with an older version.',
            'NO_MANIFEST',
            1,
            'Run `bek init --preset <preset> --force` to reinitialize with manifest support'
        );
    }

    const currentVersion = getCliVersion();
    const result: SyncResult = {
        added: [],
        updated: [],
        removed: [],
        unchanged: [],
    };

    if (!json) {
        logger.info(`Current kit version: ${chalk.dim(manifest.kitVersion)}`);
        logger.info(`CLI version: ${chalk.cyan(currentVersion)}`);
        logger.info(`Preset: ${chalk.cyan(manifest.preset || 'custom')}`);
        logger.newline();
    }

    // Confirm before syncing (unless --force or --dry-run)
    if (!force && !dryRun) {
        const readline = await import('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
            rl.question(chalk.yellow('Sync will update kit files. Continue? [Y/n] '), resolve);
        });
        rl.close();

        if (answer.toLowerCase() === 'n') {
            logger.info('Aborted');
            return;
        }
    }

    // Create backup if requested
    if (backup && !dryRun) {
        if (!json) logger.info('Creating backup...');
        result.backupPath = createBackup(target);
        if (!json) logger.verbose(`  Backup: ${result.backupPath}`);
    }

    // Re-copy preset files if preset is known
    if (manifest.preset) {
        const preset = getPreset(manifest.preset);
        if (preset) {
            if (!json) logger.info(`Syncing preset: ${chalk.cyan(manifest.preset)}`);

            // Get current files before sync
            const beforeFiles = getAllFiles(path.join(target, BACKEND_KIT_DIR));

            if (!dryRun) {
                // Copy preset files (this handles patterns + checklists)
                copyPresetFiles(preset, target, false);
            }

            // Get files after sync
            const afterFiles = getAllFiles(path.join(target, BACKEND_KIT_DIR));

            // Determine added/updated/removed
            for (const file of afterFiles) {
                if (!beforeFiles.includes(file)) {
                    result.added.push(file);
                } else {
                    result.updated.push(file);
                }
            }
            for (const file of beforeFiles) {
                if (!afterFiles.includes(file) && !file.startsWith('.backup')) {
                    result.removed.push(file);
                }
            }
        }
    }

    // Update manifest
    if (!dryRun) {
        manifest.kitVersion = currentVersion;
        manifest.lastSyncedAt = new Date().toISOString();
        saveManifest(target, manifest);
    }

    // Output results
    if (json) {
        console.log(JSON.stringify({
            success: true,
            dryRun,
            ...result,
            manifest: {
                version: currentVersion,
                preset: manifest.preset,
            },
        }, null, 2));
        return;
    }

    logger.newline();

    if (dryRun) {
        logger.info(chalk.yellow('DRY RUN - no changes applied'));
        logger.newline();
    }

    // Summary
    logger.log(chalk.bold('Summary:'));
    logger.log(`  ${chalk.green('Added')}: ${result.added.length} files`);
    logger.log(`  ${chalk.blue('Updated')}: ${result.updated.length} files`);
    logger.log(`  ${chalk.red('Removed')}: ${result.removed.length} files`);

    if (result.backupPath) {
        logger.newline();
        logger.log(chalk.dim(`Backup saved to: ${result.backupPath}`));
    }

    logger.newline();
    if (dryRun) {
        logger.success('Run without --dry-run to apply changes');
    } else {
        logger.success('Sync complete!');
    }
}
