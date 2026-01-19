export interface RemoveOptions {
    target?: string;
    yes?: boolean;
    dryRun?: boolean;
    json?: boolean;
}
/**
 * Remove command implementation
 */
export declare function removeCommand(options?: RemoveOptions): Promise<void>;
//# sourceMappingURL=remove.d.ts.map