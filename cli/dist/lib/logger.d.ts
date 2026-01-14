export type LogLevel = 'silent' | 'default' | 'verbose' | 'debug';
export declare function setLogLevel(level: LogLevel): void;
export declare function getLogLevel(): LogLevel;
export declare const logger: {
    error: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    success: (message: string, ...args: unknown[]) => void;
    verbose: (message: string, ...args: unknown[]) => void;
    debug: (message: string, ...args: unknown[]) => void;
    log: (message: string, ...args: unknown[]) => void;
    newline: () => void;
    header: (message: string) => void;
    dim: (message: string) => void;
    item: (label: string, value: string, status?: "ok" | "warn" | "error") => void;
};
export default logger;
//# sourceMappingURL=logger.d.ts.map