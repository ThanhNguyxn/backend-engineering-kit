import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import logger from '../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GenerateDocsOptions {
    output?: string;
    format?: 'markdown' | 'json';
}

interface Adapter {
    id: string;
    name: string;
    description: string;
    type: string;
    legacy: boolean;
    sourcePath: string;
    targetFile: string;
    tags: string[];
    migrationNotes?: string;
}

interface Template {
    id: string;
    name: string;
    description: string;
    type: string;
    ref: string;
}

interface Registry {
    templates: Template[];
    adapters: Adapter[];
    presets: any[];
}

function loadRegistry(): Registry {
    const registryPath = path.resolve(__dirname, '../../../templates/registry.yaml');
    const content = fs.readFileSync(registryPath, 'utf-8');
    return yaml.parse(content);
}

function categorizeAdapters(adapters: Adapter[]) {
    const ideAdapters: Adapter[] = [];
    const extensionAdapters: Adapter[] = [];
    const cliAdapters: Adapter[] = [];

    for (const adapter of adapters) {
        if (adapter.id === 'adapter-base') continue;

        const tags = adapter.tags || [];

        if (tags.includes('ide') || tags.includes('editor')) {
            ideAdapters.push(adapter);
        } else if (tags.includes('cli') || tags.includes('terminal')) {
            cliAdapters.push(adapter);
        } else {
            extensionAdapters.push(adapter);
        }
    }

    return { ideAdapters, extensionAdapters, cliAdapters };
}

function generateAdapterDocs(adapters: Adapter[]): string {
    const { ideAdapters, extensionAdapters, cliAdapters } = categorizeAdapters(adapters);

    let md = `---
title: AI Adapters
description: Configuration templates for AI coding assistants
---

# AI Adapters

BEK supports **${adapters.length - 1}** AI coding assistants (excluding base template).

## IDE/Editor Adapters (${ideAdapters.length})

| Adapter | File | Description |
|---------|------|-------------|
`;

    for (const a of ideAdapters) {
        md += `| ${a.name.replace(' Instructions', '').replace(' Rules', '')} | \`${a.targetFile}\` | ${a.description} |\n`;
    }

    md += `
## Extension Adapters (${extensionAdapters.length})

| Adapter | File | Description |
|---------|------|-------------|
`;

    for (const a of extensionAdapters) {
        md += `| ${a.name.replace(' Instructions', '').replace(' Rules', '')} | \`${a.targetFile}\` | ${a.description} |\n`;
    }

    md += `
## CLI/Terminal Adapters (${cliAdapters.length})

| Adapter | File | Description |
|---------|------|-------------|
`;

    for (const a of cliAdapters) {
        md += `| ${a.name.replace(' Instructions', '').replace(' Rules', '')} | \`${a.targetFile}\` | ${a.description} |\n`;
    }

    md += `
## Usage

\`\`\`bash
# List all adapters
bek templates list --type adapter

# Initialize with specific adapter
bek init --ai claude
bek init --ai copilot,cursor

# Multiple adapters
bek init --ai claude,copilot,cline
\`\`\`

---

*Auto-generated from \`templates/registry.yaml\`*
*Run \`bek docs generate\` to regenerate*
`;

    return md;
}

function generateTemplateDocs(templates: Template[]): string {
    let md = `---
title: Project Templates
description: Project scaffolding templates
---

# Project Templates

BEK provides **${templates.length}** project templates.

| Template | Description |
|----------|-------------|
`;

    for (const t of templates) {
        md += `| ${t.name} | ${t.description} |\n`;
    }

    md += `
## Usage

\`\`\`bash
# List all templates
bek templates list

# Initialize with template
bek init <template-id>

# Validate templates
bek templates validate
\`\`\`

---

*Auto-generated from \`templates/registry.yaml\`*
`;

    return md;
}

function generateSummaryJson(registry: Registry) {
    return {
        generated: new Date().toISOString(),
        counts: {
            templates: registry.templates.length,
            adapters: registry.adapters.length,
            presets: registry.presets.length,
            total: registry.templates.length + registry.adapters.length + registry.presets.length,
        },
        adapters: registry.adapters.map(a => ({
            id: a.id,
            name: a.name,
            targetFile: a.targetFile,
            legacy: a.legacy,
        })),
        templates: registry.templates.map(t => ({
            id: t.id,
            name: t.name,
        })),
    };
}

export async function generateDocsCommand(options: GenerateDocsOptions = {}): Promise<void> {
    logger.header('📄 Generating docs from registry...');

    const registry = loadRegistry();
    const outputDir = options.output || path.resolve(__dirname, '../../../docs-site/src/content/docs/reference');

    // Ensure output dir exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    if (options.format === 'json') {
        const summary = generateSummaryJson(registry);
        const jsonPath = path.join(outputDir, 'registry-summary.json');
        fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
        logger.success(`Generated: ${jsonPath}`);
        console.log(JSON.stringify(summary, null, 2));
        return;
    }

    // Generate adapter docs
    const adapterMd = generateAdapterDocs(registry.adapters);
    const adapterPath = path.join(outputDir, 'adapters.md');
    fs.writeFileSync(adapterPath, adapterMd);
    logger.success(`Generated: ${adapterPath}`);

    // Generate template docs
    const templateMd = generateTemplateDocs(registry.templates);
    const templatePath = path.join(outputDir, 'templates.md');
    fs.writeFileSync(templatePath, templateMd);
    logger.success(`Generated: ${templatePath}`);

    // Summary
    logger.newline();
    logger.info(`Templates: ${registry.templates.length}`);
    logger.info(`Adapters: ${registry.adapters.length}`);
    logger.info(`Presets: ${registry.presets.length}`);
    logger.success('Docs generated successfully!');
}
