export interface SearchOptions {
    tag?: string;
    stack?: string;
    level?: string;
    scope?: string;
    maturity?: string;
    works_with?: string;
    limit?: number;
}
export interface SearchResultItem {
    id: string;
    title: string;
    type: string;
    path: string;
    level: string;
    scope: string;
    maturity: string;
    tags: string;
    stacks: string;
    works_with: string;
    score: number;
    snippet: string;
}
export declare function search(query: string, options?: SearchOptions): Promise<SearchResultItem[]>;
export declare function searchCommand(query: string, options: SearchOptions): Promise<void>;
export declare function listCommand(options: SearchOptions): Promise<void>;
//# sourceMappingURL=search.d.ts.map