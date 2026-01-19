/**
 * bek remove command
 * Removes BEK-generated files from a project
 */
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import logger from '../lib/logger.js';
import { CLIError } from '../lib/errors.js';
import { loadManifest, hasBackendKit, BACKEND_KIT_DIR, } from '../lib/manifest.js';
/**
 * Recursively remove a directory
 */
function removeDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}
/**
 * Remove command implementation
 */
export async function removeCommand(options = {}) {
    const target = path.resolve(options.target || '.');
    const yes = options.yes ?? false;
    const dryRun = options.dryRun ?? false;
    const json = options.json ?? false;
    if (!json) {
        logger.header('🗑️  Removing Backend Kit');
    }
    // Check if project has BEK installed
    if (!hasBackendKit(target)) {
        if (json) {
            console.log(JSON.stringify({
                success: false,
                error: 'No Backend Kit found',
            }));
            return;
        }
        throw new CLIError('No Backend Kit found in this directory', 'NO_BACKEND_KIT', 1, 'Nothing to remove');
    }
    // Load manifest to get list of files
    const manifest = loadManifest(target);
    const result = {
        removedFiles: [],
        removedDirs: [],
        aiAdaptersRemoved: [],
    };
    // Collect files to remove
    const backendKitDir = path.join(target, BACKEND_KIT_DIR);
    const configFiles = [
        'bek.config.json',
        'bek.config.js',
        'bek.config.mjs',
        '.bekrc',
        '.bekrc.json',
    ];
    // Check what will be removed
    if (!json) {
        logger.info('The following will be removed:');
        logger.log(`  ${chalk.red('Directory')}: ${BACKEND_KIT_DIR}/`);
        for (const configFile of configFiles) {
            const configPath = path.join(target, configFile);
            if (fs.existsSync(configPath)) {
                logger.log(`  ${chalk.red('Config')}: ${configFile}`);
                result.removedFiles.push(configFile);
            }
        }
        // AI adapters from manifest
        if (manifest?.aiAdapters) {
            for (const adapter of manifest.aiAdapters) {
                if (fs.existsSync(path.join(target, adapter.path))) {
                    logger.log(`  ${chalk.red('AI Adapter')}: ${adapter.path}`);
                    result.aiAdaptersRemoved.push(adapter.path);
                }
            }
        }
        logger.newline();
    }
    // Confirm removal
    if (!yes && !dryRun) {
        const readline = await import('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        const answer = await new Promise((resolve) => {
            rl.question(chalk.red('Are you sure you want to remove Backend Kit? [y/N] '), resolve);
        });
        rl.close();
        if (answer.toLowerCase() !== 'y') {
            logger.info('Aborted');
            return;
        }
    }
    if (dryRun) {
        if (!json) {
            logger.info(chalk.yellow('DRY RUN - no changes applied'));
        }
    }
    else {
        // Remove .backend-kit directory
        removeDir(backendKitDir);
        result.removedDirs.push(BACKEND_KIT_DIR);
        // Remove config files
        for (const configFile of configFiles) {
            const configPath = path.join(target, configFile);
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
                result.removedFiles.push(configFile);
            }
        }
        // Remove AI adapters listed in manifest
        if (manifest?.aiAdapters) {
            for (const adapter of manifest.aiAdapters) {
                const adapterPath = path.join(target, adapter.path);
                if (fs.existsSync(adapterPath)) {
                    fs.unlinkSync(adapterPath);
                    result.aiAdaptersRemoved.push(adapter.path);
                }
            }
        }
    }
    // Output results
    if (json) {
        console.log(JSON.stringify({
            success: true,
            dryRun,
            ...result,
        }, null, 2));
        return;
    }
    logger.newline();
    logger.log(chalk.bold('Removed:'));
    logger.log(`  ${chalk.red('Directories')}: ${result.removedDirs.length}`);
    logger.log(`  ${chalk.red('Config files')}: ${result.removedFiles.length}`);
    logger.log(`  ${chalk.red('AI adapters')}: ${result.aiAdaptersRemoved.length}`);
    logger.newline();
    if (dryRun) {
        logger.success('Run without --dry-run to apply changes');
    }
    else {
        logger.success('Backend Kit removed successfully');
    }
}
//# sourceMappingURL=remove.js.map