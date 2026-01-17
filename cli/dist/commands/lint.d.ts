export interface LintOptions {
    fix?: boolean;
    json?: boolean;
}
interface LintIssue {
    file: string;
    line?: number;
    level: 'error' | 'warning';
    rule: string;
    message: string;
    fixable?: boolean;
}
interface LintResult {
    issues: LintIssue[];
    stats: {
        files: number;
        errors: number;
        warnings: number;
        fixed: number;
    };
}
export declare function lintContent(baseDir?: string, fix?: boolean): Promise<LintResult>;
export declare function lintCommand(options?: LintOptions): Promise<void>;
export {};
//# sourceMappingURL=lint.d.ts.map