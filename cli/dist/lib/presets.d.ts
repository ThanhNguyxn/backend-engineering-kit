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
//# sourceMappingURL=presets.d.ts.map