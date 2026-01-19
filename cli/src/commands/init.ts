import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { createInterface } from 'readline';
import logger from '../lib/logger.js';
import { createConfigFile, BekConfig } from '../lib/config.js';
import { CLIError } from '../lib/errors.js';
import { getPreset, getPresetNames, copyPresetFiles, PRESETS, AI_ADAPTERS, getAvailableAdapters, copyAdapterFiles, copyIndustryRules } from '../lib/presets.js';
import { createManifest, saveManifest, getCliVersion, BACKEND_KIT_DIR } from '../lib/manifest.js';

interface Template {
    name: string;
    description: string;
    features: string[];
}

const TEMPLATES: Record<string, Template> = {
    minimal: {
        name: 'Minimal',
        description: 'Basic setup with patterns only',
        features: ['patterns', 'search']
    },
    standard: {
        name: 'Standard',
        description: 'Patterns + checklists + validation',
        features: ['patterns', 'checklists', 'search', 'validation']
    },
    advanced: {
        name: 'Advanced (Option B)',
        description: 'Full setup with all adapters + CI/CD',
        features: ['patterns', 'checklists', 'search', 'validation', 'adapters', 'ci', 'docker']
    }
};

export interface InitOptions {
    template?: string;
    target?: string;
    ai?: string;
    force?: boolean;
    dryRun?: boolean;
    yes?: boolean;
    preset?: string;
    out?: string;
}

async function prompt(question: string, defaultValue?: string): Promise<string> {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        const q = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
        rl.question(q, (answer) => {
            rl.close();
            resolve(answer.trim() || defaultValue || '');
        });
    });
}

async function confirm(question: string, defaultYes = true): Promise<boolean> {
    const suffix = defaultYes ? '[Y/n]' : '[y/N]';
    const answer = await prompt(`${question} ${suffix}`);

    if (!answer) return defaultYes;
    return answer.toLowerCase().startsWith('y');
}

async function selectTemplate(): Promise<string> {
    console.log();
    console.log(chalk.bold('Available templates:'));
    console.log();

    const keys = Object.keys(TEMPLATES);
    keys.forEach((key, index) => {
        const t = TEMPLATES[key];
        console.log(`  ${chalk.cyan(`${index + 1})`)} ${chalk.bold(t.name)}`);
        console.log(chalk.dim(`     ${t.description}`));
        console.log(chalk.dim(`     Features: ${t.features.join(', ')}`));
    });

    console.log();
    const answer = await prompt('Select template (1-3)', '2');
    const index = parseInt(answer, 10) - 1;

    if (index >= 0 && index < keys.length) {
        return keys[index];
    }
    return 'standard';
}

function createDirectoryStructure(
    targetDir: string,
    template: Template,
    dryRun: boolean
): string[] {
    const createdPaths: string[] = [];

    const dirs = [
        '.shared/production-backend-kit/patterns',
        '.shared/production-backend-kit/checklists',
        '.shared/production-backend-kit/db'
    ];

    if (template.features.includes('adapters')) {
        dirs.push('adapters/claude', 'adapters/cursor', 'adapters/copilot', 'adapters/codex');
    }

    if (template.features.includes('ci')) {
        dirs.push('.github/workflows');
    }

    for (const dir of dirs) {
        const fullPath = path.join(targetDir, dir);
        createdPaths.push(dir);

        if (!dryRun) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
    }

    return createdPaths;
}

function createSampleFiles(
    targetDir: string,
    template: Template,
    dryRun: boolean
): string[] {
    const createdFiles: string[] = [];

    // Sample pattern
    const samplePattern = `---
id: sample-pattern
title: Sample Pattern
tags: [sample, example]
scope: api
maturity: stable
works_with: [all]
---

# Sample Pattern

## Problem

Describe the problem this pattern solves.

## When to use

- Scenario 1
- Scenario 2

## Solution

Describe the solution approach.

## Pitfalls

| Pitfall | How to Avoid |
|---------|--------------|
| Common mistake | Prevention strategy |

## Checklist

- [ ] Item 1
- [ ] Item 2

## Snippets

\`\`\`
Example code or pseudocode
\`\`\`

## Sources

- Reference — https://example.com
`;

    const patternPath = '.shared/production-backend-kit/patterns/sample-pattern.md';
    createdFiles.push(patternPath);

    if (!dryRun) {
        fs.writeFileSync(path.join(targetDir, patternPath), samplePattern);
    }

    // Sample checklist if included
    if (template.features.includes('checklists')) {
        const sampleChecklist = `---
id: sample-checklist
title: Sample Checklist
tags: [sample, review]
scope: mixed
maturity: stable
works_with: [all]
---

# Sample Checklist

Review checklist for sample processes.

## Items

- [ ] First check item
- [ ] Second check item
- [ ] Third check item

## Sources

- Reference — https://example.com
`;

        const checklistPath = '.shared/production-backend-kit/checklists/sample-checklist.md';
        createdFiles.push(checklistPath);

        if (!dryRun) {
            fs.writeFileSync(path.join(targetDir, checklistPath), sampleChecklist);
        }
    }

    // CI workflow if included
    if (template.features.includes('ci')) {
        const ciWorkflow = `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npx production-backend-kit validate
`;

        const ciPath = '.github/workflows/ci.yml';
        createdFiles.push(ciPath);

        if (!dryRun) {
            fs.writeFileSync(path.join(targetDir, ciPath), ciWorkflow);
        }
    }

    return createdFiles;
}

export async function initCommand(options: InitOptions = {}): Promise<void> {
    const target = path.resolve(options.target || '.');
    const force = options.force ?? false;
    const dryRun = options.dryRun ?? false;
    const interactive = !options.yes && !options.template;

    logger.header('🚀 Initialize Backend Kit');

    // Check if already initialized
    const configExists = fs.existsSync(path.join(target, 'bek.config.json')) ||
        fs.existsSync(path.join(target, '.bekrc'));

    if (configExists && !force) {
        throw new CLIError(
            'Project already initialized (config file exists)',
            'ALREADY_INIT',
            1,
            'Use --force to reinitialize'
        );
    }

    // Handle preset mode
    if (options.preset) {
        const preset = getPreset(options.preset);
        if (!preset) {
            throw new CLIError(
                `Unknown preset: ${options.preset}`,
                'INVALID_PRESET',
                1,
                `Available: ${getPresetNames().join(', ')}`
            );
        }

        logger.info(`Using preset: ${chalk.bold(preset.name)}`);
        logger.info(chalk.dim(preset.description));

        if (dryRun) {
            logger.newline();
            logger.info(chalk.yellow('DRY RUN - no changes will be made'));
        }

        logger.newline();
        logger.info('Copying preset files...');

        const { copied, missing } = copyPresetFiles(preset, target, dryRun);

        for (const file of copied) {
            logger.log(`  ${chalk.green('+')} ${file}`);
        }

        if (missing.length > 0) {
            logger.warn(`Missing source files: ${missing.join(', ')}`);
        }

        // Handle AI adapters
        let aiAdapters: string[] = preset.adapters || [];
        if (options.ai) {
            if (options.ai === 'all') {
                aiAdapters = getAvailableAdapters();
            } else {
                aiAdapters = options.ai.split(',').map(a => a.trim());
            }
        }

        if (aiAdapters.length > 0) {
            logger.newline();
            logger.info('Installing AI adapters...');
            const adapterResult = copyAdapterFiles(aiAdapters, target, dryRun);
            
            for (const file of adapterResult.copied) {
                logger.log(`  ${chalk.green('+')} ${file}`);
            }
            
            if (adapterResult.missing.length > 0) {
                logger.warn(`Unknown adapters: ${adapterResult.missing.join(', ')}`);
            }
        }

        // Copy industry rules for generate command
        logger.newline();
        logger.info('Installing industry rules...');
        const rulesInstalled = copyIndustryRules(target, dryRun);
        if (rulesInstalled) {
            logger.log(`  ${chalk.green('+')} .backend-kit/rules/industry-rules.yaml`);
        }

        // Create config
        const config: Partial<BekConfig> = {
            name: path.basename(target),
            preset: options.preset,
            features: {
                search: true,
                validation: true,
                adapters: preset.adapters || []
            }
        };

        if (!dryRun) {
            const configPath = createConfigFile(target, config, 'json');
            logger.log(`  ${chalk.green('+')} ${path.relative(target, configPath)}`);

            // Write manifest for sync/remove support
            const manifest = createManifest(getCliVersion(), {
                preset: options.preset,
                files: [...copied, 'bek.config.json'],
            });
            saveManifest(target, manifest);
            logger.log(`  ${chalk.green('+')} ${BACKEND_KIT_DIR}/.bek-manifest.json`);
        } else {
            logger.log(`  ${chalk.green('+')} bek.config.json`);
            logger.log(`  ${chalk.green('+')} ${BACKEND_KIT_DIR}/.bek-manifest.json`);
        }

        logger.newline();
        if (dryRun) {
            logger.success('Dry run complete. Run without --dry-run to apply changes.');
        } else {
            logger.success(`Preset "${preset.name}" initialized!`);
            logger.newline();
            logger.log(chalk.bold('Next steps:'));
            logger.log(chalk.dim('  1. Review patterns in .backend-kit/patterns/'));
            logger.log(chalk.dim('  2. Run: bek validate'));
            logger.log(chalk.dim('  3. Run: bek gate --checklist checklist-api-review'));
        }
        return;
    }

    // Select template
    let templateKey = options.template || 'standard';

    if (interactive) {
        templateKey = await selectTemplate();
    }

    const template = TEMPLATES[templateKey];
    if (!template) {
        throw new CLIError(
            `Unknown template: ${templateKey}`,
            'INVALID_TEMPLATE',
            1,
            `Available: ${Object.keys(TEMPLATES).join(', ')}`
        );
    }

    logger.info(`Using template: ${chalk.bold(template.name)}`);

    // Confirm if interactive
    if (interactive && !dryRun) {
        console.log();
        console.log(chalk.dim('This will create:'));
        console.log(chalk.dim(`  - Config file: bek.config.json`));
        console.log(chalk.dim(`  - Directories: ${template.features.length} feature folders`));
        console.log(chalk.dim(`  - Sample files: pattern + checklist templates`));
        console.log();

        const proceed = await confirm('Continue?');
        if (!proceed) {
            logger.info('Aborted');
            return;
        }
    }

    if (dryRun) {
        logger.info(chalk.yellow('DRY RUN - no changes will be made'));
    }

    // Create structure
    logger.newline();
    logger.info('Creating directory structure...');

    const dirs = createDirectoryStructure(target, template, dryRun);
    for (const dir of dirs) {
        logger.verbose(`  ${chalk.green('+')} ${dir}/`);
    }

    // Create files
    logger.info('Creating sample files...');

    const files = createSampleFiles(target, template, dryRun);
    for (const file of files) {
        logger.verbose(`  ${chalk.green('+')} ${file}`);
    }

    // Create config
    const config: Partial<BekConfig> = {
        name: path.basename(target),
        features: {
            search: template.features.includes('search'),
            validation: template.features.includes('validation'),
            adapters: template.features.includes('adapters')
                ? ['claude', 'cursor', 'copilot', 'codex']
                : []
        }
    };

    if (!dryRun) {
        const configPath = createConfigFile(target, config, 'json');
        logger.verbose(`  ${chalk.green('+')} ${path.relative(target, configPath)}`);
    } else {
        logger.verbose(`  ${chalk.green('+')} bek.config.json`);
    }

    // Summary
    logger.newline();

    if (dryRun) {
        logger.success('Dry run complete. Run without --dry-run to apply changes.');
    } else {
        logger.success('Project initialized!');
        logger.newline();
        logger.log(chalk.bold('Next steps:'));
        logger.log(chalk.dim('  1. Add your patterns to .shared/production-backend-kit/patterns/'));
        logger.log(chalk.dim('  2. Run: npx production-backend-kit build-db'));
        logger.log(chalk.dim('  3. Run: npx production-backend-kit search "your query"'));
    }
}
