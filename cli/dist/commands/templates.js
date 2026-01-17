/**
 * Templates command - list, validate, and manage templates
 */
import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { validateRegistryFile, listTemplates } from '../lib/templates.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Find templates directory
function findTemplatesDir() {
    // Try relative to CLI dist
    const cliTemplates = path.resolve(__dirname, '../../..', 'templates');
    if (fs.existsSync(path.join(cliTemplates, 'registry.yaml'))) {
        return cliTemplates;
    }
    // Try from cwd
    const cwdTemplates = path.resolve(process.cwd(), 'templates');
    if (fs.existsSync(path.join(cwdTemplates, 'registry.yaml'))) {
        return cwdTemplates;
    }
    throw new Error('Could not find templates directory');
}
function getRegistryPath() {
    return path.join(findTemplatesDir(), 'registry.yaml');
}
export const templatesCommand = new Command('templates')
    .description('Manage project templates');
// List templates
templatesCommand
    .command('list')
    .description('List available templates')
    .option('--stack <stack>', 'Filter by stack (node, python, go)')
    .option('--level <level>', 'Filter by level (minimal, standard, advanced)')
    .option('--json', 'Output as JSON')
    .action((options) => {
    try {
        const registryPath = getRegistryPath();
        let templates = listTemplates(registryPath);
        // Apply filters
        if (options.stack) {
            templates = templates.filter(t => t.stack === options.stack);
        }
        if (options.level) {
            templates = templates.filter(t => t.level === options.level);
        }
        if (options.json) {
            console.log(JSON.stringify(templates, null, 2));
            return;
        }
        if (templates.length === 0) {
            console.log(chalk.yellow('No templates found matching criteria'));
            return;
        }
        console.log(chalk.bold('\n📦 Available Templates\n'));
        for (const template of templates) {
            const stackColor = {
                node: chalk.green,
                python: chalk.blue,
                go: chalk.cyan,
                rust: chalk.red,
                multi: chalk.magenta,
            }[template.stack] || chalk.white;
            const levelBadge = {
                minimal: chalk.gray('[minimal]'),
                standard: chalk.yellow('[standard]'),
                advanced: chalk.red('[advanced]'),
            }[template.level] || '';
            console.log(`  ${chalk.bold(template.id)} ${stackColor(template.stack)} ${levelBadge}`);
            console.log(`    ${chalk.dim(template.description)}`);
            if (template.tags.length > 0) {
                console.log(`    ${chalk.dim('Tags:')} ${template.tags.map(t => chalk.cyan(t)).join(', ')}`);
            }
            console.log();
        }
        console.log(chalk.dim(`  Use "bek init <template-id>" to create a new project\n`));
    }
    catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
    }
});
// Validate templates
templatesCommand
    .command('validate')
    .description('Validate registry and all templates')
    .option('--json', 'Output as JSON')
    .action((options) => {
    try {
        const registryPath = getRegistryPath();
        const result = validateRegistryFile(registryPath);
        if (options.json) {
            console.log(JSON.stringify(result, null, 2));
            process.exit(result.valid ? 0 : 1);
            return;
        }
        console.log(chalk.bold('\n🔍 Template Validation Results\n'));
        // Summary
        console.log(`  Templates: ${result.summary.templatesCount}`);
        console.log(`  Valid: ${chalk.green(result.summary.validTemplates)}`);
        console.log(`  Invalid: ${result.summary.invalidTemplates > 0 ? chalk.red(result.summary.invalidTemplates) : '0'}`);
        console.log();
        // Errors
        if (result.errors.length > 0) {
            console.log(chalk.red.bold('  ❌ Errors:\n'));
            for (const error of result.errors) {
                console.log(`    [${error.type}] ${error.path}`);
                console.log(`      ${error.message}`);
                if (error.details) {
                    console.log(`      ${chalk.dim(error.details)}`);
                }
                console.log();
            }
        }
        // Warnings
        if (result.warnings.length > 0) {
            console.log(chalk.yellow.bold('  ⚠️ Warnings:\n'));
            for (const warning of result.warnings) {
                console.log(`    ${warning.path}: ${warning.message}`);
            }
            console.log();
        }
        if (result.valid) {
            console.log(chalk.green.bold('  ✅ All templates are valid!\n'));
        }
        else {
            console.log(chalk.red.bold('  ❌ Validation failed\n'));
            process.exit(1);
        }
    }
    catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
    }
});
export default templatesCommand;
//# sourceMappingURL=templates.js.map