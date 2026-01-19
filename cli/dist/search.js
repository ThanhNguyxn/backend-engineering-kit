import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import MiniSearch from 'minisearch';
import chalk from 'chalk';
import { buildDatabase } from './buildDb.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Domain mapping from pattern ID prefix
const DOMAIN_MAP = {
    api: { prefix: 'api-', name: 'API Design', description: 'REST/GraphQL APIs, validation, versioning' },
    db: { prefix: 'db-', name: 'Database', description: 'SQL, NoSQL, transactions, migrations' },
    sec: { prefix: 'sec-', name: 'Security', description: 'Auth, encryption, secrets, OWASP' },
    rel: { prefix: 'rel-', name: 'Reliability', description: 'Circuit breakers, retries, outbox' },
    obs: { prefix: 'obs-', name: 'Observability', description: 'Logging, metrics, tracing' },
    msg: { prefix: 'msg-', name: 'Messaging', description: 'Queues, events, pub/sub' },
    cache: { prefix: 'cache-', name: 'Caching', description: 'Redis, CDN, invalidation' },
    test: { prefix: 'test-', name: 'Testing', description: 'Unit, integration, e2e tests' },
    checklist: { prefix: 'checklist-', name: 'Checklists', description: 'Review checklists' },
};
// Load or build the search index
async function loadIndex(baseDir) {
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
    const docs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));
    const miniSearch = MiniSearch.loadJSON(JSON.stringify(indexData), {
        fields: ['title', 'tags', 'stacks', 'sectionsText', 'checklistText', 'sourcesText'],
        storeFields: ['id', 'title', 'type', 'path', 'level', 'tags', 'stacks']
    });
    return { miniSearch, docs };
}
// Get snippet from document
function getSnippet(doc, maxLength = 200) {
    const text = doc.sectionsText || '';
    if (text.length <= maxLength)
        return text;
    return text.substring(0, maxLength).trim() + '...';
}
function applyFilters(results, docs, options) {
    const docsMap = new Map(docs.map(d => [d.id, d]));
    // Parse domain filter
    const domainPrefixes = [];
    if (options.domain) {
        const domains = options.domain.split(',').map(d => d.trim().toLowerCase());
        for (const domain of domains) {
            if (DOMAIN_MAP[domain]) {
                domainPrefixes.push(DOMAIN_MAP[domain].prefix);
            }
        }
    }
    return results
        .map(result => {
        const doc = docsMap.get(result.id);
        if (!doc)
            return null;
        // Apply domain filter
        if (domainPrefixes.length > 0) {
            const matchesDomain = domainPrefixes.some(prefix => doc.id.toLowerCase().startsWith(prefix));
            if (!matchesDomain)
                return null;
        }
        // Apply filters
        if (options.tag) {
            const tags = doc.tags.toLowerCase();
            if (!tags.includes(options.tag.toLowerCase()))
                return null;
        }
        if (options.stack) {
            const stacks = doc.stacks.toLowerCase();
            if (!stacks.includes(options.stack.toLowerCase()) && !stacks.includes('all')) {
                return null;
            }
        }
        if (options.level) {
            if (doc.level.toLowerCase() !== options.level.toLowerCase())
                return null;
        }
        if (options.scope) {
            if (doc.scope.toLowerCase() !== options.scope.toLowerCase())
                return null;
        }
        if (options.maturity) {
            if (doc.maturity.toLowerCase() !== options.maturity.toLowerCase())
                return null;
        }
        if (options.works_with) {
            const works = doc.works_with.toLowerCase();
            if (!works.includes(options.works_with.toLowerCase()) && !works.includes('all')) {
                return null;
            }
        }
        return {
            id: doc.id,
            title: doc.title,
            type: doc.type,
            path: doc.path,
            level: doc.level,
            scope: doc.scope,
            maturity: doc.maturity,
            tags: doc.tags,
            stacks: doc.stacks,
            works_with: doc.works_with,
            score: result.score,
            snippet: getSnippet(doc)
        };
    })
        .filter((r) => r !== null);
}
// Search function
export async function search(query, options = {}) {
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
function displayResults(results, query) {
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
function getLevelBadge(level) {
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
// List available domains
export function listDomains() {
    console.log(chalk.bold('\n🏷️  Available Domains\n'));
    Object.entries(DOMAIN_MAP).forEach(([key, domain]) => {
        console.log(`  ${chalk.cyan(key.padEnd(8))} ${domain.name}`);
        console.log(`           ${chalk.dim(domain.description)}\n`);
    });
    console.log(chalk.dim('Usage: bek search "query" --domain api,sec'));
    console.log(chalk.dim('       bek list --domain db'));
}
// CLI command
export async function searchCommand(query, options) {
    if (!query) {
        console.log(chalk.red('Please provide a search query'));
        console.log(chalk.dim('Usage: pbk search <query> [options]'));
        return;
    }
    try {
        const results = await search(query, options);
        displayResults(results, query);
    }
    catch (error) {
        console.error(chalk.red('Search failed:'), error);
    }
}
// List all available items
export async function listCommand(options) {
    const root = path.resolve(__dirname, '../../.shared/production-backend-kit');
    const docsPath = path.join(root, 'db', 'docs.json');
    if (!fs.existsSync(docsPath)) {
        console.log(chalk.yellow('⚠️  Index not found, building database...\n'));
        await buildDatabase(root);
    }
    const docs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));
    // Parse domain filter
    const domainPrefixes = [];
    if (options.domain) {
        const domains = options.domain.split(',').map(d => d.trim().toLowerCase());
        for (const domain of domains) {
            if (DOMAIN_MAP[domain]) {
                domainPrefixes.push(DOMAIN_MAP[domain].prefix);
            }
        }
    }
    // Apply filters
    let filtered = docs;
    // Apply domain filter first
    if (domainPrefixes.length > 0) {
        filtered = filtered.filter(d => domainPrefixes.some(prefix => d.id.toLowerCase().startsWith(prefix)));
    }
    if (options.tag) {
        filtered = filtered.filter(d => d.tags.toLowerCase().includes(options.tag.toLowerCase()));
    }
    if (options.level) {
        filtered = filtered.filter(d => d.level.toLowerCase() === options.level.toLowerCase());
    }
    if (options.scope) {
        filtered = filtered.filter(d => d.scope.toLowerCase() === options.scope.toLowerCase());
    }
    if (options.stack) {
        filtered = filtered.filter(d => d.stacks.toLowerCase().includes(options.stack.toLowerCase()) ||
            d.stacks.toLowerCase().includes('all'));
    }
    const domainLabel = options.domain ? ` in domain: ${options.domain}` : '';
    console.log(chalk.bold(`\n📚 Available items (${filtered.length})${domainLabel}:\n`));
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
//# sourceMappingURL=search.js.map