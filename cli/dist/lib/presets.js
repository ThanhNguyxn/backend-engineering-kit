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
//# sourceMappingURL=presets.js.map