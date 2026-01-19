import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOOLS = [
    // Cloud AI Assistants
    'aider', 'amazonq', 'augment', 'claude', 'cline', 
    'codeium', 'codex', 'cody', 'continue', 'copilot', 
    'cursor', 'devin', 'gemini', 'goose', 'junie', 
    'opencode', 'replit', 'supermaven', 'tabnine', 
    'trae', 'windsurf', 'zed',
    // Local AI Tools (unique feature!)
    'ollama', 'lmstudio', 'localai', 'gpt4all', 'jan', 'llm', 'llamafile'
];

interface TemplateVars {
    toolName: string;
    toolDisplayName: string;
    version: string;
    generatedDate: string;
}

function getToolDisplayName(tool: string): string {
    const names: Record<string, string> = {
        aider: 'Aider',
        amazonq: 'Amazon Q',
        augment: 'Augment Code',
        claude: 'Claude / Anthropic',
        cline: 'Cline',
        codeium: 'Codeium',
        codex: 'OpenAI Codex',
        cody: 'Sourcegraph Cody',
        continue: 'Continue',
        copilot: 'GitHub Copilot',
        cursor: 'Cursor',
        devin: 'Devin',
        gemini: 'Google Gemini',
        goose: 'Goose',
        junie: 'JetBrains Junie',
        opencode: 'OpenCode',
        replit: 'Replit',
        supermaven: 'Supermaven',
        tabnine: 'Tabnine',
        trae: 'Trae',
        windsurf: 'Windsurf',
        zed: 'Zed',
        // Local AI Tools
        ollama: 'Ollama',
        lmstudio: 'LM Studio',
        localai: 'LocalAI',
        gpt4all: 'GPT4All',
        jan: 'Jan',
        llm: 'LLM CLI',
        llamafile: 'llamafile'
    };
    return names[tool] || tool.charAt(0).toUpperCase() + tool.slice(1);
}

function renderTemplate(templateContent: string, vars: TemplateVars): string {
    let result = templateContent;
    result = result.replace(/\{\{toolName\}\}/g, vars.toolName);
    result = result.replace(/\{\{toolDisplayName\}\}/g, vars.toolDisplayName);
    result = result.replace(/\{\{version\}\}/g, vars.version);
    result = result.replace(/\{\{generatedDate\}\}/g, vars.generatedDate);
    return result;
}

function getOutputFileName(tool: string): string {
    switch (tool) {
        case 'aider':
            return '.aider.conventions.md';
        case 'amazonq':
            return 'AMAZONQ.md';
        case 'augment':
            return '.augment/rules/backend-kit.md';
        case 'claude':
            return 'CLAUDE.md';
        case 'cline':
            return '.clinerules';
        case 'codeium':
            return 'CODEIUM.md';
        case 'codex':
            return 'AGENTS.md';
        case 'cody':
            return 'CODY.md';
        case 'continue':
            return '.continue/backend-kit.md';
        case 'copilot':
            return '.github/copilot-instructions.md';
        case 'cursor':
            return '.cursorrules';
        case 'devin':
            return 'DEVIN.md';
        case 'gemini':
            return 'GEMINI.md';
        case 'goose':
            return '.goosehints';
        case 'junie':
            return '.junie/guidelines.md';
        case 'opencode':
            return '.opencode/guidelines.md';
        case 'replit':
            return 'replit.md';
        case 'supermaven':
            return 'SUPERMAVEN.md';
        case 'tabnine':
            return 'TABNINE.md';
        case 'trae':
            return '.traerules';
        case 'windsurf':
            return '.windsurfrules';
        case 'zed':
            return '.rules';
        // Local AI Tools
        case 'ollama':
            return 'Modelfile';
        case 'lmstudio':
            return '.lmstudio/presets/backend-kit.json';
        case 'localai':
            return 'models/backend-kit.yaml';
        case 'gpt4all':
            return '.gpt4all/backend-kit.txt';
        case 'jan':
            return 'jan/assistants/backend-kit.json';
        case 'llm':
            return '.llm/templates/backend-kit.yaml';
        case 'llamafile':
            return '.llamafile/system-prompt.txt';
        default:
            return `${tool}-adapter.md`;
    }
}

export async function renderAdapters(): Promise<void> {
    const adaptersDir = path.resolve(__dirname, '../adapters');
    const templatesDir = path.join(adaptersDir, 'templates');
    const generatedDir = path.join(adaptersDir, 'generated');

    // Ensure generated directory exists
    if (!fs.existsSync(generatedDir)) {
        fs.mkdirSync(generatedDir, { recursive: true });
    }

    console.log(chalk.bold('\n🔧 Rendering adapters from templates...\n'));

    const version = '1.0.0';
    const generatedDate = new Date().toISOString().split('T')[0];

    for (const tool of TOOLS) {
        const templatePath = path.join(templatesDir, `${tool}.md`);
        const outputDir = path.join(generatedDir, tool);
        const outputPath = path.join(outputDir, getOutputFileName(tool));

        if (!fs.existsSync(templatePath)) {
            console.log(chalk.yellow(`  ⚠️  Template not found: ${tool}.md`));
            continue;
        }

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Read template
        const templateContent = fs.readFileSync(templatePath, 'utf-8');

        // Render with variables
        const vars: TemplateVars = {
            toolName: tool,
            toolDisplayName: getToolDisplayName(tool),
            version,
            generatedDate
        };

        const rendered = renderTemplate(templateContent, vars);

        // Add generated header
        const header = `<!-- Generated by Backend Kit v${version} on ${generatedDate} -->\n<!-- DO NOT EDIT - Regenerate with: kit render-adapters -->\n\n`;
        const finalContent = header + rendered;

        // Write output
        fs.writeFileSync(outputPath, finalContent);
        console.log(chalk.green(`  ✓ ${tool} → ${outputPath}`));
    }

    console.log(chalk.bold('\n✅ Adapters rendered successfully!\n'));
}

// CLI command
export async function renderAdaptersCommand(): Promise<void> {
    await renderAdapters();
}

// Run if called directly
if (import.meta.url === `file://${__filename}`) {
    renderAdaptersCommand();
}
