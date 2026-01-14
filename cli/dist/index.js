#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildDbCommand, buildDatabase } from './buildDb.js';
import { searchCommand, listCommand } from './search.js';
import { validateCommand } from './validate-content.js';
import { normalizeCommand } from './normalize-content.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const program = new Command();
program
    .name('kit')
    .description('Production Backend Kit CLI - Patterns, Checklists & Search')
    .version('1.0.0');
// Build database command
program
    .command('build-db')
    .description('Build the search database from markdown files')
    .action(async () => {
    try {
        await buildDbCommand();
    }
    catch (error) {
        console.error(chalk.red('Build failed:'), error);
        process.exit(1);
    }
});
// Validate command
program
    .command('validate')
    .description('Validate content and build database')
    .option('--fix', 'Auto-fix format issues')
    .action(async (options) => {
    try {
        console.log(chalk.bold('\n🔍 Running content validation...\n'));
        if (options.fix) {
            console.log(chalk.blue('Running normalize-content...\n'));
            await normalizeCommand(false);
            console.log();
        }
        await validateCommand();
        console.log(chalk.blue('\nRebuilding database...\n'));
        await buildDbCommand();
    }
    catch (error) {
        console.error(chalk.red('Validation failed:'), error);
        process.exit(1);
    }
});
// Normalize command
program
    .command('normalize')
    .description('Auto-fix content format issues')
    .option('--dry-run', 'Show changes without applying')
    .action(async (options) => {
    await normalizeCommand(options.dryRun ?? false);
});
// Search command
program
    .command('search <query>')
    .description('Search patterns and checklists')
    .option('-t, --tag <tag>', 'Filter by tag')
    .option('-s, --stack <stack>', 'Filter by stack (e.g., postgresql, nodejs)')
    .option('-l, --level <level>', 'Filter by level (beginner|intermediate|advanced)')
    .option('--scope <scope>', 'Filter by scope (api|database|security|reliability|observability)')
    .option('--works-with <stack>', 'Filter by works_with (nodejs|python|go|all)')
    .option('--maturity <maturity>', 'Filter by maturity (stable|beta|alpha)')
    .option('-n, --limit <number>', 'Limit results (default: 10)', '10')
    .action(async (query, options) => {
    await searchCommand(query, {
        tag: options.tag,
        stack: options.stack,
        level: options.level,
        scope: options.scope,
        works_with: options.worksWith,
        maturity: options.maturity,
        limit: parseInt(options.limit, 10)
    });
});
// List command
program
    .command('list')
    .description('List all available patterns and checklists')
    .option('-t, --tag <tag>', 'Filter by tag')
    .option('-s, --stack <stack>', 'Filter by stack')
    .option('-l, --level <level>', 'Filter by level')
    .option('--scope <scope>', 'Filter by scope')
    .action(async (options) => {
    await listCommand({
        tag: options.tag,
        stack: options.stack,
        level: options.level,
        scope: options.scope
    });
});
// Show card/checklist details
program
    .command('show <id>')
    .description('Show details of a specific pattern or checklist')
    .action(async (id) => {
    const root = path.resolve(__dirname, '../../.shared/production-backend-kit');
    const docsPath = path.join(root, 'db', 'docs.json');
    if (!fs.existsSync(docsPath)) {
        console.log(chalk.yellow('Database not found, building...'));
        await buildDatabase();
    }
    const docs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));
    const doc = docs.find((d) => d.id === id);
    if (!doc) {
        console.log(chalk.red(`Card not found: ${id}`));
        console.log(chalk.dim('Use "kit list" to see available items'));
        return;
    }
    console.log(chalk.bold(`\n📄 ${doc.title}\n`));
    console.log(chalk.dim(`ID: ${doc.id}`));
    console.log(chalk.dim(`Type: ${doc.type}`));
    console.log(chalk.dim(`Level: ${doc.level}`));
    console.log(chalk.dim(`Scope: ${doc.scope}`));
    console.log(chalk.dim(`Maturity: ${doc.maturity}`));
    console.log(chalk.dim(`Tags: ${doc.tags}`));
    console.log(chalk.dim(`Works with: ${doc.works_with}`));
    console.log(chalk.dim(`Path: ${doc.path}`));
    console.log();
    // Read and display file content
    if (fs.existsSync(doc.path)) {
        const content = fs.readFileSync(doc.path, 'utf-8');
        console.log(content);
    }
});
// Init command - copy adapters to target project
program
    .command('init')
    .description('Initialize adapters in your project')
    .option('--ai <tool>', 'AI tool to init (claude|cursor|copilot|codex|all)')
    .option('--target <path>', 'Target directory (default: current)', '.')
    .option('--force', 'Overwrite existing files')
    .action(async (options) => {
    const tool = options.ai;
    const target = path.resolve(options.target);
    const force = options.force ?? false;
    if (!tool) {
        console.log(chalk.red('Please specify --ai <tool>'));
        console.log(chalk.dim('Options: claude, cursor, copilot, codex, all'));
        return;
    }
    const adaptersDir = path.resolve(__dirname, '../../adapters');
    const tools = tool === 'all' ? ['claude', 'cursor', 'copilot', 'codex'] : [tool];
    console.log(chalk.bold('\n🚀 Initializing adapters...\n'));
    for (const t of tools) {
        const sourceDir = path.join(adaptersDir, t);
        if (!fs.existsSync(sourceDir)) {
            console.log(chalk.yellow(`  ⚠️  Adapter not found: ${t}`));
            continue;
        }
        // Determine target path based on tool
        let targetPath;
        switch (t) {
            case 'claude':
                targetPath = path.join(target, '.claude', 'skills');
                break;
            case 'cursor':
                targetPath = path.join(target, '.cursor', 'rules');
                break;
            case 'copilot':
                targetPath = path.join(target, '.github');
                break;
            case 'codex':
                targetPath = path.join(target, '.codex');
                break;
            default:
                targetPath = path.join(target, '.ai', t);
        }
        // Create target directory
        fs.mkdirSync(targetPath, { recursive: true });
        // Copy files
        const files = fs.readdirSync(sourceDir);
        for (const file of files) {
            const srcFile = path.join(sourceDir, file);
            const destFile = path.join(targetPath, file);
            if (fs.existsSync(destFile) && !force) {
                console.log(chalk.yellow(`  ⏭️  Skipped (exists): ${destFile}`));
                continue;
            }
            fs.copyFileSync(srcFile, destFile);
            console.log(chalk.green(`  ✓ ${t}/${file} → ${destFile}`));
        }
    }
    console.log(chalk.bold('\n✅ Adapters initialized!\n'));
});
// Gate command - print checklist for quality gate
program
    .command('gate')
    .description('Run quality gate checklist')
    .option('--checklist <id>', 'Checklist ID to run')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
    const checklistId = options.checklist;
    if (!checklistId) {
        console.log(chalk.red('Please specify --checklist <id>'));
        console.log(chalk.dim('Use "kit list" to see available checklists'));
        return;
    }
    const root = path.resolve(__dirname, '../../.shared/production-backend-kit');
    const checklistsPath = path.join(root, 'db', 'checklists.json');
    if (!fs.existsSync(checklistsPath)) {
        console.log(chalk.yellow('Database not found, building...'));
        await buildDatabase();
    }
    const checklists = JSON.parse(fs.readFileSync(checklistsPath, 'utf-8'));
    const checklist = checklists.find((c) => c.id === checklistId);
    if (!checklist) {
        console.log(chalk.red(`Checklist not found: ${checklistId}`));
        return;
    }
    if (options.json) {
        console.log(JSON.stringify(checklist, null, 2));
        return;
    }
    console.log(chalk.bold(`\n✅ ${checklist.title}\n`));
    console.log(chalk.dim(`ID: ${checklist.id}`));
    console.log(chalk.dim(`Scope: ${checklist.scope}`));
    console.log();
    // Print checklist items
    for (const item of checklist.checklist) {
        const checkbox = item.checked ? chalk.green('☑') : chalk.gray('☐');
        console.log(`  ${checkbox} ${item.text}`);
    }
    console.log();
    process.exit(0); // Exit with success for CI usage
});
// Parse arguments
program.parse();
// Show help if no command provided
if (!process.argv.slice(2).length) {
    console.log(chalk.bold('\n🚀 Production Backend Kit CLI\n'));
    console.log('Usage: kit <command> [options]\n');
    console.log('Commands:');
    console.log('  build-db           Build the search database');
    console.log('  validate           Validate content and rebuild database');
    console.log('  normalize          Auto-fix content format issues');
    console.log('  search <query>     Search patterns and checklists');
    console.log('  list               List all available items');
    console.log('  show <id>          Show details of a specific item');
    console.log('  init               Initialize adapters in your project');
    console.log('  gate               Run quality gate checklist');
    console.log('\nExamples:');
    console.log(chalk.dim('  kit search "error handling"'));
    console.log(chalk.dim('  kit search "pagination" --scope api'));
    console.log(chalk.dim('  kit list --scope security'));
    console.log(chalk.dim('  kit init --ai claude --target ./my-project'));
    console.log(chalk.dim('  kit gate --checklist checklist-api-review'));
    console.log();
}
//# sourceMappingURL=index.js.map