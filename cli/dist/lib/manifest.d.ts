export declare const MANIFEST_FILENAME = ".bek-manifest.json";
export declare const BACKEND_KIT_DIR = ".backend-kit";
export interface BekManifest {
    /** Version of the CLI that created the manifest */
    kitVersion: string;
    /** Preset used during init */
    preset?: string;
    /** Template used during init */
    template?: string;
    /** When the kit was installed */
    installedAt: string;
    /** When the kit was last synced */
    lastSyncedAt?: string;
    /** List of files created by BEK (relative to project root) */
    files: string[];
    /** AI adapters installed and their paths */
    aiAdapters?: {
        tool: string;
        path: string;
    }[];
}
/**
 * Get the path to the manifest file
 */
export declare function getManifestPath(targetDir: string): string;
/**
 * Check if a BEK project exists in the target directory
 */
export declare function hasBackendKit(targetDir: string): boolean;
/**
 * Load the manifest from a directory
 */
export declare function loadManifest(targetDir: string): BekManifest | null;
/**
 * Save the manifest to a directory
 */
export declare function saveManifest(targetDir: string, manifest: BekManifest): void;
/**
 * Create a new manifest
 */
export declare function createManifest(kitVersion: string, options: {
    preset?: string;
    template?: string;
    files?: string[];
    aiAdapters?: {
        tool: string;
        path: string;
    }[];
}): BekManifest;
/**
 * Add files to the manifest
 */
export declare function addFilesToManifest(manifest: BekManifest, files: string[]): void;
/**
 * Get CLI version from package.json
 */
export declare function getCliVersion(): string;
//# sourceMappingURL=manifest.d.ts.map