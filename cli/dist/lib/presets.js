import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Resolve asset directory path
 * Works in both development (assets in repo root) and installed (assets in package)
 */
function resolveAssetDir(assetName) {
    // Try installed location first (cli/adapters, cli/.shared)
    const installedPath = path.resolve(__dirname, '../..', assetName);
    if (fs.existsSync(installedPath)) {
        return installedPath;
    }
    // Fall back to development location (repo root)
    const devPath = path.resolve(__dirname, '../../..', assetName);
    return devPath;
}
export const PRESETS = {
    'node-express': {
        name: 'Node.js Express',
        description: 'Express.js API with error handling, validation, and observability',
        patterns: [
            'api.error-model',
            'api.request-validation',
            'obs.structured-logging',
            'obs.correlation-id',
            'sec.rate-limiting'
        ],
        checklists: ['checklist.api-review', 'checklist.prod-readiness'],
        adapters: ['claude', 'cursor']
    },
    'node-fastify': {
        name: 'Node.js Fastify',
        description: 'Fastify API with schema validation and performance focus',
        patterns: [
            'api.error-model',
            'api.request-validation',
            'obs.structured-logging',
            'rel.timeouts',
            'sec.rate-limiting'
        ],
        checklists: ['checklist.api-review', 'checklist.reliability-review'],
        adapters: ['claude', 'cursor']
    },
    'node-minimal': {
        name: 'Node.js Minimal',
        description: 'Minimal setup with just error handling and logging',
        patterns: ['api.error-model', 'obs.structured-logging'],
        checklists: ['checklist.api-review']
    },
    'saas-multitenant-lite': {
        name: 'SaaS Multi-Tenant Lite',
        description: 'Production-ready multi-tenancy patterns for SaaS monoliths',
        patterns: [
            'sec.multitenancy-basics',
            'sec.tenant-context',
            'sec.data-isolation',
            'sec.rbac-boundaries',
            'sec.billing-integration',
            'api.error-model',
            'obs.structured-logging',
            'obs.correlation-id',
            'sec.rate-limiting'
        ],
        checklists: [
            'checklist.multitenancy-review',
            'checklist.security-review',
            'checklist.api-review',
            'checklist.prod-readiness'
        ],
        adapters: ['claude', 'cursor']
    }
};
export function getPreset(name) {
    return PRESETS[name];
}
export function listPresets() {
    return Object.values(PRESETS);
}
export function getPresetNames() {
    return Object.keys(PRESETS);
}
export function validatePresetName(name) {
    return name in PRESETS;
}
export function getSourcePath(type, id) {
    const baseDir = path.join(resolveAssetDir('.shared'), 'production-backend-kit');
    if (type === 'pattern') {
        return path.join(baseDir, 'patterns', `${id}.md`);
    }
    return path.join(baseDir, 'checklists', `${id}.md`);
}
export function copyPresetFiles(preset, targetDir, dryRun) {
    const copied = [];
    const missing = [];
    const kitDir = path.join(targetDir, '.backend-kit');
    const patternsDir = path.join(kitDir, 'patterns');
    const checklistsDir = path.join(kitDir, 'checklists');
    if (!dryRun) {
        fs.mkdirSync(patternsDir, { recursive: true });
        fs.mkdirSync(checklistsDir, { recursive: true });
    }
    for (const patternId of preset.patterns) {
        const srcPath = getSourcePath('pattern', patternId);
        const destPath = path.join(patternsDir, `${patternId}.md`);
        if (fs.existsSync(srcPath)) {
            if (!dryRun) {
                fs.copyFileSync(srcPath, destPath);
            }
            copied.push(`.backend-kit/patterns/${patternId}.md`);
        }
        else {
            missing.push(patternId);
        }
    }
    for (const checklistId of preset.checklists) {
        const srcPath = getSourcePath('checklist', checklistId);
        const destPath = path.join(checklistsDir, `${checklistId}.md`);
        if (fs.existsSync(srcPath)) {
            if (!dryRun) {
                fs.copyFileSync(srcPath, destPath);
            }
            copied.push(`.backend-kit/checklists/${checklistId}.md`);
        }
        else {
            missing.push(checklistId);
        }
    }
    return { copied, missing };
}
// =============================================================================
// AI ADAPTER SUPPORT
// =============================================================================
export const AI_ADAPTERS = {
    'claude': {
        name: 'Claude Code',
        folder: '.claude/skills/backend-kit',
        file: 'SKILL.md',
        template: 'claude.md',
    },
    'cursor': {
        name: 'Cursor',
        folder: '.cursor/commands',
        file: 'backend-kit.md',
        template: 'cursor.md',
    },
    'copilot': {
        name: 'GitHub Copilot',
        folder: '.github',
        file: 'copilot-instructions.md',
        template: 'copilot.md',
    },
    'windsurf': {
        name: 'Windsurf',
        folder: '.',
        file: '.windsurfrules',
        template: 'windsurf.md',
    },
    'codex': {
        name: 'Codex CLI',
        folder: '.codex/skills/backend-kit',
        file: 'skill.md',
        template: 'codex.md',
    },
    'kiro': {
        name: 'Kiro',
        folder: '.kiro/steering',
        file: 'backend-kit.md',
        template: 'base.md', // Use base if no specific template
    },
    'gemini': {
        name: 'Gemini CLI',
        folder: '.gemini/skills/backend-kit',
        file: 'skill.md',
        template: 'gemini.md',
    },
    'roocode': {
        name: 'Roo Code',
        folder: '.roo/rules',
        file: 'backend-kit.md',
        template: 'base.md',
    },
    'qoder': {
        name: 'Qoder',
        folder: '.qoder/skills',
        file: 'backend-kit.md',
        template: 'base.md',
    },
    'cline': {
        name: 'Cline',
        folder: '.',
        file: '.clinerules',
        template: 'cline.md',
    },
    'aider': {
        name: 'Aider',
        folder: '.',
        file: '.aider.conventions.md',
        template: 'aider.md',
    },
    'continue': {
        name: 'Continue',
        folder: '.continue',
        file: 'backend-kit.md',
        template: 'continue.md',
    },
    'zed': {
        name: 'Zed',
        folder: '.',
        file: '.rules',
        template: 'zed.md',
    },
    'amazonq': {
        name: 'Amazon Q',
        folder: '.amazonq',
        file: 'backend-kit.md',
        template: 'amazonq.md',
    },
    'augment': {
        name: 'Augment Code',
        folder: '.augment/rules',
        file: 'backend-kit.md',
        template: 'augment.md',
    },
    'codeium': {
        name: 'Codeium',
        folder: '.codeium',
        file: 'instructions.md',
        template: 'codeium.md',
    },
    'cody': {
        name: 'Sourcegraph Cody',
        folder: '.cody',
        file: 'instructions.md',
        template: 'cody.md',
    },
    'devin': {
        name: 'Devin',
        folder: '.devin',
        file: 'AGENTS.md',
        template: 'devin.md',
    },
    'goose': {
        name: 'Goose',
        folder: '.',
        file: '.goosehints',
        template: 'goose.md',
    },
    'junie': {
        name: 'JetBrains Junie',
        folder: '.junie',
        file: 'guidelines.md',
        template: 'junie.md',
    },
    'opencode': {
        name: 'OpenCode',
        folder: '.opencode',
        file: 'AGENTS.md',
        template: 'opencode.md',
    },
    'replit': {
        name: 'Replit AI',
        folder: '.',
        file: 'replit.md',
        template: 'replit.md',
    },
    'supermaven': {
        name: 'Supermaven',
        folder: '.supermaven',
        file: 'backend-kit.md',
        template: 'supermaven.md',
    },
    'tabnine': {
        name: 'Tabnine',
        folder: '.tabnine',
        file: 'backend-kit.md',
        template: 'tabnine.md',
    },
    'trae': {
        name: 'Trae',
        folder: '.',
        file: '.traerules',
        template: 'trae.md',
    },
    // ==========================================================================
    // LOCAL AI TOOLS (Unique feature - run models locally!)
    // ==========================================================================
    'ollama': {
        name: 'Ollama',
        folder: '.',
        file: 'Modelfile.backend-kit',
        template: 'ollama.md',
    },
    'lmstudio': {
        name: 'LM Studio',
        folder: '.lmstudio/presets',
        file: 'backend-kit.json',
        template: 'lmstudio.md',
    },
    'localai': {
        name: 'LocalAI',
        folder: 'models',
        file: 'backend-kit.yaml',
        template: 'localai.md',
    },
    'gpt4all': {
        name: 'GPT4All',
        folder: '.gpt4all',
        file: 'backend-kit-prompt.txt',
        template: 'gpt4all.md',
    },
    'jan': {
        name: 'Jan',
        folder: 'jan/assistants',
        file: 'backend-kit.json',
        template: 'jan.md',
    },
    'llm': {
        name: 'LLM CLI (Simon Willison)',
        folder: '.llm/templates',
        file: 'backend-kit.yaml',
        template: 'llm.md',
    },
    'llamafile': {
        name: 'llamafile (Mozilla)',
        folder: '.llamafile',
        file: 'system-prompt.txt',
        template: 'llamafile.md',
    },
};
export function getAvailableAdapters() {
    return Object.keys(AI_ADAPTERS);
}
export function copyAdapterFiles(adapters, targetDir, dryRun) {
    const copied = [];
    const missing = [];
    const templatesDir = path.join(resolveAssetDir('adapters'), 'templates');
    const sharedDir = path.join(resolveAssetDir('.shared'), 'production-backend-kit');
    for (const adapterId of adapters) {
        const adapter = AI_ADAPTERS[adapterId];
        if (!adapter) {
            missing.push(adapterId);
            continue;
        }
        const templatePath = path.join(templatesDir, adapter.template);
        if (!fs.existsSync(templatePath)) {
            // Try base template
            const basePath = path.join(templatesDir, 'base.md');
            if (!fs.existsSync(basePath)) {
                missing.push(adapterId);
                continue;
            }
        }
        const destFolder = path.join(targetDir, adapter.folder);
        const destFile = path.join(destFolder, adapter.file);
        if (!dryRun) {
            fs.mkdirSync(destFolder, { recursive: true });
            // Read and process template
            let templatePath2 = path.join(templatesDir, adapter.template);
            if (!fs.existsSync(templatePath2)) {
                templatePath2 = path.join(templatesDir, 'base.md');
            }
            const content = fs.readFileSync(templatePath2, 'utf-8');
            fs.writeFileSync(destFile, content);
        }
        copied.push(`${adapter.folder}/${adapter.file}`);
    }
    // Also copy .shared folder for adapters that need it
    const sharedAdapters = ['cursor', 'windsurf', 'kiro', 'roocode', 'qoder', 'gemini'];
    const needsShared = adapters.some(a => sharedAdapters.includes(a));
    if (needsShared) {
        const destShared = path.join(targetDir, '.shared', 'production-backend-kit');
        if (!dryRun) {
            // Copy patterns and checklists to .shared
            copyDirRecursive(sharedDir, destShared, ['db']);
        }
        copied.push('.shared/production-backend-kit/');
    }
    return { copied, missing };
}
// Copy industry rules to .backend-kit/rules
export function copyIndustryRules(targetDir, dryRun) {
    const rulesDir = path.join(resolveAssetDir('.shared'), 'production-backend-kit', 'rules');
    const destDir = path.join(targetDir, '.backend-kit', 'rules');
    if (!fs.existsSync(rulesDir)) {
        return false;
    }
    if (!dryRun) {
        fs.mkdirSync(destDir, { recursive: true });
        copyDirRecursive(rulesDir, destDir, []);
    }
    return true;
}
function copyDirRecursive(src, dest, exclude = []) {
    if (!fs.existsSync(src))
        return;
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        if (exclude.includes(entry.name))
            continue;
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath, exclude);
        }
        else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
//# sourceMappingURL=presets.js.map