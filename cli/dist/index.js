#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildDbCommand, buildDatabase } from './buildDb.js';
import { searchCommand, listCommand } from './search.js';
import { validateContent } from './validate-content.js';
import { normalizeCommand } from './normalize-content.js';
import { doctorCommand } from './commands/doctor.js';
import { initCommand } from './commands/init.js';
import { lintCommand } from './commands/lint.js';
import { setLogLevel } from './lib/logger.js';
import { wrapCommand, CLIError } from './lib/errors.js';
import logger from './lib/logger.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const program = new Command();
// Global options
program
    .name('bek')
    .description('Backend Engineering Kit CLI - Patterns, Checklists & AI Adapters')
    .version('0.2.0')
    .option('--debug', 'Enable debug mode (show stack traces)')
    .option('--silent', 'Suppress all output except errors')
    .option('--verbose', 'Show verbose output')
    .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.debug)
        setLogLevel('debug');
    else if (opts.silent)
        setLogLevel('silent');
    else if (opts.verbose)
        setLogLevel('verbose');
});
// Doctor command
program
    .command('doctor')
    .description('Check environment and dependencies')
    .option('--json', 'Output as JSON')
    .action(wrapCommand(async (options) => {
    await doctorCommand(options);
}));
// Init command
program
    .command('init')
    .description('Initialize a new Backend Kit project')
    .option('-t, --template <name>', 'Template to use (minimal|standard|advanced)')
    .option('-p, --preset <name>', 'Use a preset (node-express|node-fastify|node-minimal)')
    .option('--target <path>', 'Target directory', '.')
    .option('--out <path>', 'Alias for --target')
    .option('--ai <tools>', 'AI adapters to include (claude,cursor,copilot,codex,all)')
    .option('--force', 'Overwrite existing files')
    .option('--dry-run', 'Show what would be created without making changes')
    .option('-y, --yes', 'Skip prompts, use defaults')
    .action(wrapCommand(async (options) => {
    if (options.out)
        options.target = options.out;
    await initCommand(options);
}));
// Lint command
program
    .command('lint')
    .description('Lint content files for issues')
    .option('--fix', 'Auto-fix issues where possible')
    .option('--json', 'Output as JSON')
    .action(wrapCommand(async (options) => {
    await lintCommand(options);
}));
// Build database command
program
    .command('build-db')
    .description('Build the search database from markdown files')
    .action(wrapCommand(async () => {
    await buildDbCommand();
}));
// Validate command
program
    .command('validate')
    .description('Validate content and build database')
    .option('--fix', 'Auto-fix format issues')
    .option('--json', 'Output validation results as JSON')
    .action(wrapCommand(async (options) => {
    logger.header('🔍 Running content validation...');
    if (options.fix) {
        logger.info('Running normalize-content...');
        await normalizeCommand(false);
        logger.newline();
    }
    const result = await validateContent();
    if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        if (result.errors.length > 0)
            process.exit(1);
        return;
    }
    if (result.errors.length === 0) {
        logger.info('Rebuilding database...');
        await buildDbCommand();
    }
    else {
        process.exit(1);
    }
}));
// Normalize command
program
    .command('normalize')
    .description('Auto-fix content format issues')
    .option('--dry-run', 'Show changes without applying')
    .action(wrapCommand(async (options) => {
    await normalizeCommand(options.dryRun ?? false);
}));
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
    .option('--json', 'Output as JSON')
    .action(wrapCommand(async (query, options) => {
    await searchCommand(query, {
        tag: options.tag,
        stack: options.stack,
        level: options.level,
        scope: options.scope,
        works_with: options.worksWith,
        maturity: options.maturity,
        limit: parseInt(options.limit, 10)
    });
}));
// List command
program
    .command('list')
    .description('List all available patterns and checklists')
    .option('-t, --tag <tag>', 'Filter by tag')
    .option('-s, --stack <stack>', 'Filter by stack')
    .option('-l, --level <level>', 'Filter by level')
    .option('--scope <scope>', 'Filter by scope')
    .option('--json', 'Output as JSON')
    .action(wrapCommand(async (options) => {
    await listCommand({
        tag: options.tag,
        stack: options.stack,
        level: options.level,
        scope: options.scope
    });
}));
// Show card/checklist details
program
    .command('show <id>')
    .description('Show details of a specific pattern or checklist')
    .option('--json', 'Output as JSON')
    .action(wrapCommand(async (id, options) => {
    const root = path.resolve(__dirname, '../../.shared/production-backend-kit');
    const docsPath = path.join(root, 'db', 'docs.json');
    if (!fs.existsSync(docsPath)) {
        logger.warn('Database not found, building...');
        await buildDatabase();
    }
    const docs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));
    const doc = docs.find((d) => d.id === id);
    if (!doc) {
        throw new CLIError(`Card not found: ${id}`, 'NOT_FOUND', 1, 'Use "bek list" to see available items');
    }
    if (options.json) {
        console.log(JSON.stringify(doc, null, 2));
        return;
    }
    logger.header(`📄 ${doc.title}`);
    logger.item('ID', doc.id);
    logger.item('Type', doc.type);
    logger.item('Level', doc.level);
    logger.item('Scope', doc.scope);
    logger.item('Maturity', doc.maturity);
    logger.item('Tags', doc.tags);
    logger.item('Works with', doc.works_with);
    logger.item('Path', doc.path);
    logger.newline();
    // Read and display file content
    if (fs.existsSync(doc.path)) {
        const content = fs.readFileSync(doc.path, 'utf-8');
        console.log(content);
    }
}));
// Gate command - print checklist for quality gate
program
    .command('gate')
    .description('Run quality gate checklist')
    .option('--checklist <id>', 'Checklist ID to run')
    .option('--json', 'Output as JSON')
    .action(wrapCommand(async (options) => {
    const checklistId = options.checklist;
    if (!checklistId) {
        throw new CLIError('Please specify --checklist <id>', 'MISSING_ARG', 1, 'Use "bek list" to see available checklists');
    }
    const root = path.resolve(__dirname, '../../.shared/production-backend-kit');
    const checklistsPath = path.join(root, 'db', 'checklists.json');
    if (!fs.existsSync(checklistsPath)) {
        logger.warn('Database not found, building...');
        await buildDatabase();
    }
    const checklists = JSON.parse(fs.readFileSync(checklistsPath, 'utf-8'));
    const checklist = checklists.find((c) => c.id === checklistId);
    if (!checklist) {
        throw new CLIError(`Checklist not found: ${checklistId}`, 'NOT_FOUND', 1, 'Use "bek list" to see available checklists');
    }
    if (options.json) {
        console.log(JSON.stringify(checklist, null, 2));
        process.exit(0);
        return;
    }
    logger.header(`✅ ${checklist.title}`);
    logger.item('ID', checklist.id);
    logger.item('Scope', checklist.scope);
    logger.newline();
    // Print checklist items
    for (const item of checklist.checklist) {
        const checkbox = item.checked ? chalk.green('☑') : chalk.gray('☐');
        console.log(`  ${checkbox} ${item.text}`);
    }
    logger.newline();
    process.exit(0); // Exit with success for CI usage
}));
// Parse arguments
program.parse();
// Show help if no command provided
if (!process.argv.slice(2).length) {
    console.log(chalk.bold('\n🚀 Backend Engineering Kit CLI\n'));
    console.log('Usage: bek <command> [options]\n');
    console.log('Commands:');
    console.log('  doctor             Check environment and dependencies');
    console.log('  init               Initialize a new project');
    console.log('  build-db           Build the search database');
    console.log('  validate           Validate content and rebuild database');
    console.log('  normalize          Auto-fix content format issues');
    console.log('  search <query>     Search patterns and checklists');
    console.log('  list               List all available items');
    console.log('  show <id>          Show details of a specific item');
    console.log('  gate               Run quality gate checklist');
    console.log('\nGlobal Options:');
    console.log('  --debug            Show debug output and stack traces');
    console.log('  --silent           Suppress all output except errors');
    console.log('  --verbose          Show verbose output');
    console.log('\nExamples:');
    console.log(chalk.dim('  bek doctor'));
    console.log(chalk.dim('  bek init --template standard'));
    console.log(chalk.dim('  bek search "error handling"'));
    console.log(chalk.dim('  bek validate --json'));
    console.log(chalk.dim('  bek gate --checklist checklist-api-review'));
    console.log();
}
//# sourceMappingURL=index.js.map