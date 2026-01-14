import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import fg from 'fast-glob';
import MiniSearch from 'minisearch';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Parse sections by ## headings
function parseSections(content) {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = null;
    let contentLines = [];
    for (const line of lines) {
        const headingMatch = line.match(/^##\s+(.+)$/);
        if (headingMatch) {
            if (currentSection) {
                currentSection.content = contentLines.join('\n').trim();
                sections.push(currentSection);
            }
            currentSection = { name: headingMatch[1].trim(), content: '' };
            contentLines = [];
        }
        else if (currentSection) {
            contentLines.push(line);
        }
    }
    if (currentSection) {
        currentSection.content = contentLines.join('\n').trim();
        sections.push(currentSection);
    }
    return sections;
}
// Parse checklist items (- [ ] or - [x] or just - )
function parseChecklist(content) {
    const items = [];
    const lines = content.split('\n');
    for (const line of lines) {
        // Match - [ ] or - [x] format
        const checkboxMatch = line.match(/^-\s+\[([ xX])\]\s+(.+)$/);
        if (checkboxMatch) {
            items.push({
                text: checkboxMatch[2].trim(),
                checked: checkboxMatch[1].toLowerCase() === 'x'
            });
            continue;
        }
        // Match simple bullet - format (for checklists without checkbox)
        const bulletMatch = line.match(/^-\s+(?!\[)(.+)$/);
        if (bulletMatch && !line.includes('http')) {
            items.push({
                text: bulletMatch[1].trim(),
                checked: false
            });
        }
    }
    return items;
}
// Parse sources with various formats
function parseSources(content) {
    const sources = [];
    const lines = content.split('\n');
    for (const line of lines) {
        // Format: "- Name — URL" or "- Name: URL"
        const namedMatch = line.match(/^-\s+(.+?)(?:\s*[—:]\s*|\s+)(https?:\/\/[^\s]+)/);
        if (namedMatch) {
            sources.push({
                name: namedMatch[1].trim(),
                url: namedMatch[2].trim()
            });
            continue;
        }
        // Format: just URL
        const urlMatch = line.match(/^-\s*(https?:\/\/[^\s]+)/);
        if (urlMatch) {
            sources.push({
                name: urlMatch[1],
                url: urlMatch[1].trim()
            });
        }
    }
    return sources;
}
// Parse a single markdown file
function parseMarkdownFile(filePath, type) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const { data, content: body } = matter(content);
        const frontmatter = data;
        const sections = parseSections(body);
        // Find checklist section
        const checklistSection = sections.find(s => s.name.toLowerCase().includes('checklist'));
        const checklist = checklistSection ? parseChecklist(checklistSection.content) : [];
        // Find sources section
        const sourcesSection = sections.find(s => s.name.toLowerCase().includes('source'));
        const sources = sourcesSection ? parseSources(sourcesSection.content) : [];
        return {
            id: frontmatter.id || path.basename(filePath, '.md'),
            title: frontmatter.title || path.basename(filePath, '.md'),
            tags: frontmatter.tags || [],
            level: frontmatter.level || 'intermediate',
            stacks: frontmatter.stacks || frontmatter.works_with || ['all'],
            scope: frontmatter.scope || 'mixed',
            maturity: frontmatter.maturity || 'stable',
            works_with: frontmatter.works_with || frontmatter.stacks || ['all'],
            path: filePath,
            type,
            sections,
            checklist,
            sources,
            rawContent: body
        };
    }
    catch (error) {
        console.error(`Error parsing ${filePath}:`, error);
        return null;
    }
}
// Convert parsed card to searchable document
function toSearchableDoc(card) {
    return {
        id: card.id,
        title: card.title,
        tags: card.tags.join(' '),
        stacks: card.stacks.join(' '),
        level: card.level,
        scope: card.scope,
        maturity: card.maturity,
        works_with: card.works_with.join(' '),
        type: card.type,
        path: card.path,
        sectionsText: card.sections.map(s => `${s.name} ${s.content}`).join(' '),
        checklistText: card.checklist.map(c => c.text).join(' '),
        sourcesText: card.sources.map(s => s.name).join(' ')
    };
}
// Build the database
export async function buildDatabase(baseDir) {
    const root = baseDir || path.resolve(__dirname, '../../.shared/production-backend-kit');
    const patternsDir = path.join(root, 'patterns');
    const checklistsDir = path.join(root, 'checklists');
    const dbDir = path.join(root, 'db');
    // Ensure db directory exists
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    // Find all markdown files
    const patternFiles = await fg('*.md', { cwd: patternsDir, absolute: true });
    const checklistFiles = await fg('*.md', { cwd: checklistsDir, absolute: true });
    console.log(`Found ${patternFiles.length} patterns, ${checklistFiles.length} checklists`);
    // Parse all files
    const cards = [];
    const checklists = [];
    for (const file of patternFiles) {
        const parsed = parseMarkdownFile(file, 'pattern');
        if (parsed)
            cards.push(parsed);
    }
    for (const file of checklistFiles) {
        const parsed = parseMarkdownFile(file, 'checklist');
        if (parsed)
            checklists.push(parsed);
    }
    // Create searchable documents
    const allCards = [...cards, ...checklists];
    const docs = allCards.map(toSearchableDoc);
    // Build MiniSearch index
    const miniSearch = new MiniSearch({
        fields: ['title', 'tags', 'stacks', 'sectionsText', 'checklistText', 'sourcesText'],
        storeFields: ['id', 'title', 'type', 'path', 'level', 'tags', 'stacks'],
        searchOptions: {
            boost: { title: 2, tags: 1.5 },
            fuzzy: 0.2,
            prefix: true
        }
    });
    miniSearch.addAll(docs);
    const indexData = miniSearch.toJSON();
    // Write output files
    fs.writeFileSync(path.join(dbDir, 'cards.json'), JSON.stringify(cards, null, 2));
    fs.writeFileSync(path.join(dbDir, 'checklists.json'), JSON.stringify(checklists, null, 2));
    fs.writeFileSync(path.join(dbDir, 'docs.json'), JSON.stringify(docs, null, 2));
    fs.writeFileSync(path.join(dbDir, 'index.json'), JSON.stringify(indexData, null, 2));
    console.log(`✅ Database built successfully!`);
    console.log(`   - ${cards.length} pattern cards`);
    console.log(`   - ${checklists.length} checklists`);
    console.log(`   - ${docs.length} searchable documents`);
    console.log(`   - Output: ${dbDir}`);
    return { cards, checklists, docs, indexData };
}
// CLI command
export async function buildDbCommand() {
    console.log('🔨 Building database...\n');
    await buildDatabase();
}
//# sourceMappingURL=buildDb.js.map