import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
    const baseDir = path.resolve(__dirname, '../../../.shared/production-backend-kit');
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
        folder: '.windsurf/workflows',
        file: 'backend-kit.md',
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
        folder: '.cline',
        file: 'backend-kit.md',
        template: 'cline.md',
    },
    'aider': {
        name: 'Aider',
        folder: '.aider',
        file: 'backend-kit.md',
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
        folder: '.zed',
        file: 'backend-kit.md',
        template: 'zed.md',
    },
};
export function getAvailableAdapters() {
    return Object.keys(AI_ADAPTERS);
}
export function copyAdapterFiles(adapters, targetDir, dryRun) {
    const copied = [];
    const missing = [];
    const templatesDir = path.resolve(__dirname, '../../../adapters/templates');
    const sharedDir = path.resolve(__dirname, '../../../.shared/production-backend-kit');
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
    const rulesDir = path.resolve(__dirname, '../../../.shared/production-backend-kit/rules');
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