import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import MiniSearch, { SearchResult } from 'minisearch';
import chalk from 'chalk';
import { buildDatabase, SearchableDoc } from './buildDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SearchOptions {
    tag?: string;
    stack?: string;
    level?: string;
    limit?: number;
}

export interface SearchResultItem {
    id: string;
    title: string;
    type: string;
    path: string;
    level: string;
    tags: string;
    stacks: string;
    score: number;
    snippet: string;
}

// Load or build the search index
async function loadIndex(baseDir?: string): Promise<{
    miniSearch: MiniSearch<SearchableDoc>;
    docs: SearchableDoc[];
}> {
    const root = baseDir || path.resolve(__dirname, '../../.shared/production-backend-kit');
    const indexPath = path.join(root, 'db', 'index.json');
    const docsPath = path.join(root, 'db', 'docs.json');

    // Check if index exists
    if (!fs.existsSync(indexPath) || !fs.existsSync(docsPath)) {
        console.log(chalk.yellow('⚠️  Index not found, building database...\n'));
        await buildDatabase(root);
    }

    // Load index and docs
    const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    const docs: SearchableDoc[] = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));

    const miniSearch = MiniSearch.loadJSON<SearchableDoc>(JSON.stringify(indexData), {
        fields: ['title', 'tags', 'stacks', 'sectionsText', 'checklistText', 'sourcesText'],
        storeFields: ['id', 'title', 'type', 'path', 'level', 'tags', 'stacks']
    });

    return { miniSearch, docs };
}

// Get snippet from document
function getSnippet(doc: SearchableDoc, maxLength: number = 200): string {
    const text = doc.sectionsText || '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
}

// Apply filters to results
function applyFilters(
    results: SearchResult[],
    docs: SearchableDoc[],
    options: SearchOptions
): SearchResultItem[] {
    const docsMap = new Map(docs.map(d => [d.id, d]));

    return results
        .map(result => {
            const doc = docsMap.get(result.id);
            if (!doc) return null;

            // Apply filters
            if (options.tag) {
                const tags = doc.tags.toLowerCase();
                if (!tags.includes(options.tag.toLowerCase())) return null;
            }

            if (options.stack) {
                const stacks = doc.stacks.toLowerCase();
                if (!stacks.includes(options.stack.toLowerCase()) && !stacks.includes('all')) {
                    return null;
                }
            }

            if (options.level) {
                if (doc.level.toLowerCase() !== options.level.toLowerCase()) return null;
            }

            return {
                id: doc.id,
                title: doc.title,
                type: doc.type,
                path: doc.path,
                level: doc.level,
                tags: doc.tags,
                stacks: doc.stacks,
                score: result.score,
                snippet: getSnippet(doc)
            };
        })
        .filter((r): r is SearchResultItem => r !== null);
}

// Search function
export async function search(
    query: string,
    options: SearchOptions = {}
): Promise<SearchResultItem[]> {
    const { miniSearch, docs } = await loadIndex();
    const limit = options.limit || 10;

    // Perform search
    const results = miniSearch.search(query, {
        boost: { title: 2, tags: 1.5 },
        fuzzy: 0.2,
        prefix: true
    });

    // Apply filters and limit
    const filtered = applyFilters(results, docs, options);
    return filtered.slice(0, limit);
}

// Format and display results
function displayResults(results: SearchResultItem[], query: string): void {
    if (results.length === 0) {
        console.log(chalk.yellow(`\nNo results found for "${query}"`));
        return;
    }

    console.log(chalk.bold(`\n🔍 Found ${results.length} results for "${query}":\n`));

    results.forEach((result, index) => {
        const typeIcon = result.type === 'pattern' ? '📘' : '✅';
        const levelBadge = getLevelBadge(result.level);

        console.log(chalk.bold(`${index + 1}. ${typeIcon} ${result.title}`));
        console.log(chalk.dim(`   ID: ${result.id}`));
        console.log(chalk.dim(`   Level: ${levelBadge} | Score: ${result.score.toFixed(2)}`));
        console.log(chalk.dim(`   Tags: ${result.tags}`));
        console.log(chalk.dim(`   Path: ${result.path}`));
        console.log(chalk.gray(`   ${result.snippet}`));
        console.log();
    });
}

function getLevelBadge(level: string): string {
    switch (level.toLowerCase()) {
        case 'beginner':
            return chalk.green('🟢 beginner');
        case 'intermediate':
            return chalk.yellow('🟡 intermediate');
        case 'advanced':
            return chalk.red('🔴 advanced');
        default:
            return level;
    }
}

// CLI command
export async function searchCommand(
    query: string,
    options: SearchOptions
): Promise<void> {
    if (!query) {
        console.log(chalk.red('Please provide a search query'));
        console.log(chalk.dim('Usage: pbk search <query> [options]'));
        return;
    }

    try {
        const results = await search(query, options);
        displayResults(results, query);
    } catch (error) {
        console.error(chalk.red('Search failed:'), error);
    }
}

// List all available items
export async function listCommand(options: SearchOptions): Promise<void> {
    const root = path.resolve(__dirname, '../../.shared/production-backend-kit');
    const docsPath = path.join(root, 'db', 'docs.json');

    if (!fs.existsSync(docsPath)) {
        console.log(chalk.yellow('⚠️  Index not found, building database...\n'));
        await buildDatabase(root);
    }

    const docs: SearchableDoc[] = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));

    // Apply filters
    let filtered = docs;

    if (options.tag) {
        filtered = filtered.filter(d =>
            d.tags.toLowerCase().includes(options.tag!.toLowerCase())
        );
    }

    if (options.level) {
        filtered = filtered.filter(d =>
            d.level.toLowerCase() === options.level!.toLowerCase()
        );
    }

    if (options.stack) {
        filtered = filtered.filter(d =>
            d.stacks.toLowerCase().includes(options.stack!.toLowerCase()) ||
            d.stacks.toLowerCase().includes('all')
        );
    }

    console.log(chalk.bold(`\n📚 Available items (${filtered.length}):\n`));

    const patterns = filtered.filter(d => d.type === 'pattern');
    const checklists = filtered.filter(d => d.type === 'checklist');

    if (patterns.length > 0) {
        console.log(chalk.bold('📘 Patterns:'));
        patterns.forEach(p => {
            console.log(`   - ${p.id}: ${p.title} [${p.level}]`);
        });
        console.log();
    }

    if (checklists.length > 0) {
        console.log(chalk.bold('✅ Checklists:'));
        checklists.forEach(c => {
            console.log(`   - ${c.id}: ${c.title}`);
        });
        console.log();
    }
}
