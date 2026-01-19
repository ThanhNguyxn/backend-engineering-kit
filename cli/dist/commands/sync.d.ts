export interface SyncOptions {
    target?: string;
    dryRun?: boolean;
    force?: boolean;
    backup?: boolean;
    json?: boolean;
}
/**
 * Sync command implementation
 */
export declare function syncCommand(options?: SyncOptions): Promise<void>;
//# sourceMappingURL=sync.d.ts.map