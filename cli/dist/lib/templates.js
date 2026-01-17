/**
 * Templates Registry Validator
 * Validates registry.yaml and all template.yaml files
 * Supports both new project templates and legacy adapters/presets
 */
import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Load and parse YAML file
 */
function loadYaml(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return parseYaml(content);
    }
    catch {
        return null;
    }
}
/**
 * Validate registry.yaml
 */
export function validateRegistryFile(registryPath) {
    const errors = [];
    const warnings = [];
    let templatesCount = 0;
    let validTemplates = 0;
    let invalidTemplates = 0;
    let adaptersCount = 0;
    let presetsCount = 0;
    let legacyCount = 0;
    // Load registry
    const registry = loadYaml(registryPath);
    if (!registry) {
        errors.push({
            type: 'schema',
            path: registryPath,
            message: 'Failed to parse registry.yaml',
        });
        return { valid: false, errors, warnings, summary: { templatesCount: 0, validTemplates: 0, invalidTemplates: 0, adaptersCount: 0, presetsCount: 0, legacyCount: 0 } };
    }
    // Basic schema validation
    if (registry.apiVersion !== 'templates/v2') {
        errors.push({
            type: 'schema',
            path: 'registry.yaml',
            message: `Invalid apiVersion: expected 'templates/v2', got '${registry.apiVersion}'`,
        });
    }
    if (registry.kind !== 'Registry') {
        errors.push({
            type: 'schema',
            path: 'registry.yaml',
            message: `Invalid kind: expected 'Registry', got '${registry.kind}'`,
        });
    }
    // Validate project templates
    const templates = registry.templates || [];
    templatesCount = templates.length;
    const registryDir = path.dirname(registryPath);
    for (const templateEntry of templates) {
        const templatePath = path.resolve(registryDir, templateEntry.ref);
        if (!fs.existsSync(templatePath)) {
            errors.push({
                type: 'integrity',
                path: templateEntry.ref,
                message: `Template file not found: ${templateEntry.ref}`,
            });
            invalidTemplates++;
            continue;
        }
        const result = validateTemplateFile(templatePath);
        if (result.valid) {
            validTemplates++;
        }
        else {
            invalidTemplates++;
            errors.push(...result.errors);
        }
        warnings.push(...result.warnings);
    }
    // Validate adapters (legacy)
    const adapters = registry.adapters || [];
    adaptersCount = adapters.length;
    for (const adapter of adapters) {
        if (adapter.legacy)
            legacyCount++;
        const adapterPath = path.resolve(registryDir, adapter.sourcePath);
        if (!fs.existsSync(adapterPath)) {
            if (adapter.legacy) {
                warnings.push({
                    path: adapter.sourcePath,
                    message: `Legacy adapter file not found: ${adapter.sourcePath}`,
                });
            }
            else {
                errors.push({
                    type: 'integrity',
                    path: adapter.sourcePath,
                    message: `Adapter file not found: ${adapter.sourcePath}`,
                });
            }
        }
        // Validate required fields
        if (!adapter.id) {
            errors.push({
                type: 'schema',
                path: 'registry.yaml/adapters',
                message: 'Adapter missing required field: id',
            });
        }
        if (!adapter.name) {
            warnings.push({
                path: `adapter:${adapter.id}`,
                message: 'Adapter missing recommended field: name',
            });
        }
    }
    // Validate presets (legacy)
    const presets = registry.presets || [];
    presetsCount = presets.length;
    for (const preset of presets) {
        if (preset.legacy)
            legacyCount++;
        if (!preset.id) {
            errors.push({
                type: 'schema',
                path: 'registry.yaml/presets',
                message: 'Preset missing required field: id',
            });
        }
        if (!preset.patterns || preset.patterns.length === 0) {
            warnings.push({
                path: `preset:${preset.id}`,
                message: 'Preset has no patterns defined',
            });
        }
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        summary: {
            templatesCount,
            validTemplates,
            invalidTemplates,
            adaptersCount,
            presetsCount,
            legacyCount,
        },
    };
}
/**
 * Validate individual template.yaml
 */
export function validateTemplateFile(templatePath) {
    const errors = [];
    const warnings = [];
    const template = loadYaml(templatePath);
    if (!template) {
        errors.push({
            type: 'schema',
            path: templatePath,
            message: 'Failed to parse template.yaml',
        });
        return { valid: false, errors, warnings, summary: { templatesCount: 1, validTemplates: 0, invalidTemplates: 1, adaptersCount: 0, presetsCount: 0, legacyCount: 0 } };
    }
    if (template.apiVersion !== 'templates/v2') {
        errors.push({
            type: 'schema',
            path: templatePath,
            message: `Invalid apiVersion: expected 'templates/v2'`,
        });
    }
    if (template.kind !== 'Template') {
        errors.push({
            type: 'schema',
            path: templatePath,
            message: `Invalid kind: expected 'Template'`,
        });
    }
    if (!template.metadata?.id) {
        errors.push({
            type: 'schema',
            path: templatePath,
            message: 'Missing required field: metadata.id',
        });
    }
    if (!template.spec?.stack) {
        errors.push({
            type: 'schema',
            path: templatePath,
            message: 'Missing required field: spec.stack',
        });
    }
    // Check skeleton files
    const templateDir = path.dirname(templatePath);
    const skeletonDir = path.join(templateDir, 'skeleton');
    if (!fs.existsSync(skeletonDir)) {
        errors.push({
            type: 'integrity',
            path: templatePath,
            message: 'Missing skeleton/ directory',
        });
    }
    else {
        const requiredFiles = template.spec?.files?.required || [];
        for (const file of requiredFiles) {
            const filePath = path.join(skeletonDir, file);
            if (!fs.existsSync(filePath)) {
                errors.push({
                    type: 'integrity',
                    path: templatePath,
                    message: `Required file missing in skeleton: ${file}`,
                });
            }
        }
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        summary: {
            templatesCount: 1,
            validTemplates: errors.length === 0 ? 1 : 0,
            invalidTemplates: errors.length > 0 ? 1 : 0,
            adaptersCount: 0,
            presetsCount: 0,
            legacyCount: 0,
        },
    };
}
/**
 * Get list of all templates from registry
 */
export function listTemplates(registryPath, options) {
    const registry = loadYaml(registryPath);
    if (!registry)
        return [];
    const templates = [];
    const registryDir = path.dirname(registryPath);
    const includeLegacy = options?.includeLegacy ?? false;
    const filterType = options?.type;
    // Project templates
    const entries = registry.templates || [];
    for (const entry of entries) {
        if (filterType && filterType !== 'project')
            continue;
        const templatePath = path.resolve(registryDir, entry.ref);
        const template = loadYaml(templatePath);
        if (!template?.metadata || !template?.spec)
            continue;
        templates.push({
            id: template.metadata.id,
            name: template.metadata.name,
            description: template.metadata.description,
            stack: template.spec.stack,
            level: template.spec.level,
            tags: template.spec.tags || [],
            path: templatePath,
            type: 'project',
            legacy: entry.legacy ?? false,
        });
    }
    // Adapters (legacy)
    if (includeLegacy) {
        const adapters = registry.adapters || [];
        for (const adapter of adapters) {
            if (filterType && filterType !== 'adapter')
                continue;
            templates.push({
                id: adapter.id,
                name: adapter.name,
                description: adapter.description || '',
                stack: adapter.stack || 'multi',
                level: adapter.level || 'standard',
                tags: adapter.tags || [],
                path: path.resolve(registryDir, adapter.sourcePath),
                type: 'adapter',
                legacy: adapter.legacy ?? true,
                migrationNotes: adapter.migrationNotes,
            });
        }
    }
    // Presets (legacy)
    if (includeLegacy) {
        const presets = registry.presets || [];
        for (const preset of presets) {
            if (filterType && filterType !== 'preset')
                continue;
            templates.push({
                id: preset.id,
                name: preset.name,
                description: preset.description || '',
                stack: preset.stack || 'node',
                level: preset.level || 'standard',
                tags: preset.tags || [],
                path: '',
                type: 'preset',
                legacy: preset.legacy ?? true,
                migrationNotes: preset.migrationNotes,
            });
        }
    }
    return templates;
}
//# sourceMappingURL=templates.js.map