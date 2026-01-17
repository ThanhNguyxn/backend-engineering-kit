/**
 * Templates Registry Validator
 * Validates registry.yaml and all template.yaml files (simplified version)
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
    // Load registry
    const registry = loadYaml(registryPath);
    if (!registry) {
        errors.push({
            type: 'schema',
            path: registryPath,
            message: 'Failed to parse registry.yaml',
        });
        return { valid: false, errors, warnings, summary: { templatesCount: 0, validTemplates: 0, invalidTemplates: 0 } };
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
    // Validate each template ref
    const templates = registry.templates || [];
    templatesCount = templates.length;
    const registryDir = path.dirname(registryPath);
    for (const templateEntry of templates) {
        const templatePath = path.resolve(registryDir, templateEntry.ref);
        // Check if template.yaml exists
        if (!fs.existsSync(templatePath)) {
            errors.push({
                type: 'integrity',
                path: templateEntry.ref,
                message: `Template file not found: ${templateEntry.ref}`,
            });
            invalidTemplates++;
            continue;
        }
        // Validate template
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
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        summary: { templatesCount, validTemplates, invalidTemplates },
    };
}
/**
 * Validate individual template.yaml
 */
export function validateTemplateFile(templatePath) {
    const errors = [];
    const warnings = [];
    // Load template
    const template = loadYaml(templatePath);
    if (!template) {
        errors.push({
            type: 'schema',
            path: templatePath,
            message: 'Failed to parse template.yaml',
        });
        return { valid: false, errors, warnings, summary: { templatesCount: 1, validTemplates: 0, invalidTemplates: 1 } };
    }
    // Basic schema validation
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
    // Check skeleton files exist
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
        // Check required files
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
        summary: { templatesCount: 1, validTemplates: errors.length === 0 ? 1 : 0, invalidTemplates: errors.length > 0 ? 1 : 0 },
    };
}
/**
 * Get list of all templates from registry
 */
export function listTemplates(registryPath) {
    const registry = loadYaml(registryPath);
    if (!registry)
        return [];
    const templates = [];
    const registryDir = path.dirname(registryPath);
    const entries = registry.templates || [];
    for (const entry of entries) {
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
        });
    }
    return templates;
}
//# sourceMappingURL=templates.js.map