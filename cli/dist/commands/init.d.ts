export interface InitOptions {
    template?: string;
    target?: string;
    ai?: string;
    force?: boolean;
    dryRun?: boolean;
    yes?: boolean;
    preset?: string;
    out?: string;
}
export declare function initCommand(options?: InitOptions): Promise<void>;
//# sourceMappingURL=init.d.ts.map