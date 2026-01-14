export interface BekConfig {
    name?: string;
    version?: string;
    patternsDir?: string;
    checklistsDir?: string;
    outputDir?: string;
    features?: {
        search?: boolean;
        validation?: boolean;
        adapters?: string[];
    };
    logLevel?: 'silent' | 'default' | 'verbose' | 'debug';
}
declare const DEFAULT_CONFIG: BekConfig;
export declare function findConfigFile(startDir?: string): string | null;
export declare function loadConfig(configPath?: string): Promise<BekConfig>;
export declare function validateConfig(config: BekConfig): BekConfig;
export declare function createConfigFile(targetDir: string, config?: Partial<BekConfig>, format?: 'json' | 'js'): string;
export { DEFAULT_CONFIG };
//# sourceMappingURL=config.d.ts.map