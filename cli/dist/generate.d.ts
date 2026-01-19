export interface IndustryRule {
    id: string;
    name: string;
    description: string;
    architecture: {
        pattern: string;
        database: string;
        caching: string;
        queue: string;
    };
    security_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    compliance: string[];
    required_patterns: string[];
    recommended_patterns: string[];
    anti_patterns: string[];
    checklist: string;
    key_decisions: Array<{
        question: string;
        options: Array<{
            name: string;
            when: string;
        }>;
    }>;
}
export interface GenerateOptions {
    industry?: string;
    stack?: string;
    projectName?: string;
    persist?: boolean;
    format?: 'ascii' | 'markdown' | 'json';
    output?: string;
}
export interface ArchitectureDecision {
    projectName: string;
    industry: IndustryRule;
    stack: string;
    timestamp: string;
    patterns: {
        required: string[];
        recommended: string[];
    };
    antiPatterns: string[];
    checklist: string;
}
export declare function detectIndustry(query: string): string | null;
/**
 * Detect industry from package.json in current directory
 */
export declare function detectIndustryFromProject(targetDir?: string): {
    industry: string | null;
    confidence: 'high' | 'medium' | 'low';
    signals: string[];
};
export declare function generateArchitecture(options: GenerateOptions): ArchitectureDecision;
export declare function formatAscii(decision: ArchitectureDecision): string;
export declare function formatMarkdown(decision: ArchitectureDecision): string;
export declare function persistArchitecture(decision: ArchitectureDecision, targetDir: string, page?: string): string;
export interface GenerateCommandOptions {
    industry?: string;
    stack?: string;
    project?: string;
    persist?: boolean;
    format?: 'ascii' | 'markdown' | 'json';
    module?: string;
    target?: string;
    json?: boolean;
}
export declare function generateCommand(options?: GenerateCommandOptions): Promise<void>;
export declare function listIndustries(): void;
export interface DetectOptions {
    target?: string;
    json?: boolean;
    suggest?: boolean;
}
export declare function detectCommand(options?: DetectOptions): Promise<void>;
//# sourceMappingURL=generate.d.ts.map