export declare class CLIError extends Error {
    readonly code: string;
    readonly exitCode: number;
    readonly hint?: string | undefined;
    constructor(message: string, code?: string, exitCode?: number, hint?: string | undefined);
}
export declare class ConfigError extends CLIError {
    constructor(message: string, hint?: string);
}
export declare class ValidationError extends CLIError {
    constructor(message: string, hint?: string);
}
export declare class EnvironmentError extends CLIError {
    constructor(message: string, hint?: string);
}
export declare function handleError(error: unknown): never;
export declare function wrapCommand<T extends (...args: any[]) => Promise<void>>(fn: T): (...args: Parameters<T>) => Promise<void>;
//# sourceMappingURL=errors.d.ts.map