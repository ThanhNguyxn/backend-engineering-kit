/**
 * Templates Registry Validator
 * Validates registry.yaml and all template.yaml files
 * Supports both new project templates and legacy adapters/presets
 */
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    summary: {
        templatesCount: number;
        validTemplates: number;
        invalidTemplates: number;
        adaptersCount: number;
        presetsCount: number;
        legacyCount: number;
    };
}
export interface ValidationError {
    type: 'schema' | 'integrity' | 'security';
    path: string;
    message: string;
    details?: string;
}
export interface ValidationWarning {
    path: string;
    message: string;
}
export interface TemplateInfo {
    id: string;
    name: string;
    description: string;
    stack: string;
    level: string;
    tags: string[];
    path: string;
    type: 'project' | 'adapter' | 'preset';
    legacy: boolean;
    migrationNotes?: string;
}
/**
 * Validate registry.yaml
 */
export declare function validateRegistryFile(registryPath: string): ValidationResult;
/**
 * Validate individual template.yaml
 */
export declare function validateTemplateFile(templatePath: string): ValidationResult;
/**
 * Get list of all templates from registry
 */
export declare function listTemplates(registryPath: string, options?: {
    includeLegacy?: boolean;
    type?: string;
}): TemplateInfo[];
//# sourceMappingURL=templates.d.ts.map