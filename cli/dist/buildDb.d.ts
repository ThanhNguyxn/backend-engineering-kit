export interface CardFrontmatter {
    id: string;
    title: string;
    tags?: string[];
    level?: string;
    stacks?: string[];
    scope?: string;
    maturity?: string;
    works_with?: string[];
    description?: string;
    category?: string;
    version?: string;
}
export interface ParsedSection {
    name: string;
    content: string;
}
export interface ChecklistItem {
    text: string;
    checked: boolean;
}
export interface SourceItem {
    name: string;
    url: string;
}
export interface ParsedCard {
    id: string;
    title: string;
    tags: string[];
    level: string;
    stacks: string[];
    scope: string;
    maturity: string;
    works_with: string[];
    path: string;
    type: 'pattern' | 'checklist';
    sections: ParsedSection[];
    checklist: ChecklistItem[];
    sources: SourceItem[];
    rawContent: string;
}
export interface SearchableDoc {
    id: string;
    title: string;
    tags: string;
    stacks: string;
    level: string;
    scope: string;
    maturity: string;
    works_with: string;
    type: string;
    path: string;
    sectionsText: string;
    checklistText: string;
    sourcesText: string;
}
export declare function buildDatabase(baseDir?: string): Promise<{
    cards: ParsedCard[];
    checklists: ParsedCard[];
    docs: SearchableDoc[];
    indexData: object;
}>;
export declare function buildDbCommand(): Promise<void>;
//# sourceMappingURL=buildDb.d.ts.map