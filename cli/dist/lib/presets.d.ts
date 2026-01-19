export interface Preset {
    name: string;
    description: string;
    patterns: string[];
    checklists: string[];
    adapters?: string[];
    extras?: Record<string, string>;
}
export declare const PRESETS: Record<string, Preset>;
export declare function getPreset(name: string): Preset | undefined;
export declare function listPresets(): Preset[];
export declare function getPresetNames(): string[];
export declare function validatePresetName(name: string): boolean;
export declare function getSourcePath(type: 'pattern' | 'checklist', id: string): string;
export declare function copyPresetFiles(preset: Preset, targetDir: string, dryRun: boolean): {
    copied: string[];
    missing: string[];
};
export declare const AI_ADAPTERS: Record<string, {
    name: string;
    folder: string;
    file: string;
    template: string;
}>;
export declare function getAvailableAdapters(): string[];
export declare function copyAdapterFiles(adapters: string[], targetDir: string, dryRun: boolean): {
    copied: string[];
    missing: string[];
};
export declare function copyIndustryRules(targetDir: string, dryRun: boolean): boolean;
//# sourceMappingURL=presets.d.ts.map