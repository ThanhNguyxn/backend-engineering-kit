#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { buildDbCommand } from './buildDb.js';
import { searchCommand, listCommand } from './search.js';

const program = new Command();

program
    .name('pbk')
    .description('Production Backend Kit CLI - Patterns, Checklists & Search')
    .version('1.0.0');

// Build database command
program
    .command('build-db')
    .description('Build the search database from markdown files')
    .action(async () => {
        try {
            await buildDbCommand();
        } catch (error) {
            console.error(chalk.red('Build failed:'), error);
            process.exit(1);
        }
    });

// Search command
program
    .command('search <query>')
    .description('Search patterns and checklists')
    .option('-t, --tag <tag>', 'Filter by tag')
    .option('-s, --stack <stack>', 'Filter by stack (e.g., postgresql, nodejs)')
    .option('-l, --level <level>', 'Filter by level (beginner|intermediate|advanced)')
    .option('-n, --limit <number>', 'Limit results (default: 10)', '10')
    .action(async (query, options) => {
        await searchCommand(query, {
            tag: options.tag,
            stack: options.stack,
            level: options.level,
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
    .action(async (options) => {
        await listCommand({
            tag: options.tag,
            stack: options.stack,
            level: options.level
        });
    });

// Show card/checklist details
program
    .command('show <id>')
    .description('Show details of a specific pattern or checklist')
    .action(async (id) => {
        const fs = await import('fs');
        const path = await import('path');
        const { fileURLToPath } = await import('url');

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const root = path.resolve(__dirname, '../../.shared/production-backend-kit');
        const docsPath = path.join(root, 'db', 'docs.json');

        if (!fs.existsSync(docsPath)) {
            console.log(chalk.yellow('Database not found. Run: pbk build-db'));
            return;
        }

        const docs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));
        const doc = docs.find((d: any) => d.id === id);

        if (!doc) {
            console.log(chalk.red(`Card not found: ${id}`));
            console.log(chalk.dim('Use "pbk list" to see available items'));
            return;
        }

        console.log(chalk.bold(`\n📄 ${doc.title}\n`));
        console.log(chalk.dim(`ID: ${doc.id}`));
        console.log(chalk.dim(`Type: ${doc.type}`));
        console.log(chalk.dim(`Level: ${doc.level}`));
        console.log(chalk.dim(`Tags: ${doc.tags}`));
        console.log(chalk.dim(`Stacks: ${doc.stacks}`));
        console.log(chalk.dim(`Path: ${doc.path}`));
        console.log();

        // Read and display file content
        if (fs.existsSync(doc.path)) {
            const content = fs.readFileSync(doc.path, 'utf-8');
            console.log(content);
        }
    });

// Parse arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
    console.log(chalk.bold('\n🚀 Production Backend Kit CLI\n'));
    console.log('Usage: pbk <command> [options]\n');
    console.log('Commands:');
    console.log('  build-db           Build the search database');
    console.log('  search <query>     Search patterns and checklists');
    console.log('  list               List all available items');
    console.log('  show <id>          Show details of a specific item');
    console.log('\nExamples:');
    console.log(chalk.dim('  pbk search "error handling"'));
    console.log(chalk.dim('  pbk search "pagination" --tag api'));
    console.log(chalk.dim('  pbk search "security" --level advanced'));
    console.log(chalk.dim('  pbk list --tag database'));
    console.log(chalk.dim('  pbk show api-error-model'));
    console.log();
}
