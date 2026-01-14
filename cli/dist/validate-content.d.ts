interface ValidationError {
    file: string;
    type: 'missing_field' | 'duplicate_id' | 'missing_heading' | 'empty_sources';
    message: string;
}
interface ValidationResult {
    errors: ValidationError[];
    warnings: ValidationError[];
    stats: {
        patterns: number;
        checklists: number;
        totalErrors: number;
    };
}
export declare function validateContent(baseDir?: string): Promise<ValidationResult>;
export declare function validateCommand(): Promise<void>;
export {};
//# sourceMappingURL=validate-content.d.ts.map