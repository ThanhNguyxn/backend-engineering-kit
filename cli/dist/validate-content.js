import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import fg from 'fast-glob';
import chalk from 'chalk';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Required frontmatter fields
const REQUIRED_PATTERN_FIELDS = ['id', 'title', 'tags', 'scope', 'maturity', 'works_with'];
const REQUIRED_CHECKLIST_FIELDS = ['id', 'title', 'tags', 'scope', 'maturity', 'works_with'];
const REQUIRED_HEADINGS = ['Problem', 'When to use', 'Solution', 'Pitfalls', 'Checklist', 'Snippets', 'Sources'];
const CHECKLIST_HEADINGS = ['Sources']; // Checklists have different structure
// Extract headings from content
function extractHeadings(content) {
    const headingRegex = /^##\s+(.+)$/gm;
    const headings = [];
    let match;
    while ((match = headingRegex.exec(content)) !== null) {
        // Remove emojis and extra formatting
        const heading = match[1].replace(/[^\w\s&]/g, '').trim();
        headings.push(heading);
    }
    return headings;
}
// Check if sources section is empty
function hasEmptySources(content) {
    const sourcesMatch = content.match(/##\s+Sources[\s\S]*?(?=##|$)/i);
    if (!sourcesMatch)
        return true;
    const sourcesContent = sourcesMatch[0];
    // Check for at least one URL
    const hasUrls = /https?:\/\//.test(sourcesContent);
    return !hasUrls;
}
// Validate a single file
function validateFile(filePath, type, seenIds) {
    const errors = [];
    const relativePath = path.relative(process.cwd(), filePath);
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const { data: frontmatter, content: body } = matter(content);
        // Check required fields
        const requiredFields = type === 'pattern' ? REQUIRED_PATTERN_FIELDS : REQUIRED_CHECKLIST_FIELDS;
        for (const field of requiredFields) {
            if (!frontmatter[field]) {
                errors.push({
                    file: relativePath,
                    type: 'missing_field',
                    message: `Missing required field: ${field}`
                });
            }
        }
        // Check for duplicate IDs
        const id = frontmatter.id;
        if (id) {
            if (seenIds.has(id)) {
                errors.push({
                    file: relativePath,
                    type: 'duplicate_id',
                    message: `Duplicate ID: ${id}`
                });
            }
            seenIds.add(id);
        }
        // Check required headings (only for patterns)
        if (type === 'pattern') {
            const headings = extractHeadings(body);
            for (const required of REQUIRED_HEADINGS) {
                const found = headings.some(h => h.toLowerCase().includes(required.toLowerCase()));
                if (!found) {
                    errors.push({
                        file: relativePath,
                        type: 'missing_heading',
                        message: `Missing heading: ## ${required}`
                    });
                }
            }
        }
        // Check for empty sources
        if (hasEmptySources(body)) {
            errors.push({
                file: relativePath,
                type: 'empty_sources',
                message: 'Sources section is empty or missing URLs'
            });
        }
    }
    catch (error) {
        errors.push({
            file: relativePath,
            type: 'missing_field',
            message: `Failed to parse file: ${error}`
        });
    }
    return errors;
}
// Main validation function
export async function validateContent(baseDir) {
    const root = baseDir || path.resolve(__dirname, '../.shared/production-backend-kit');
    const patternsDir = path.join(root, 'patterns');
    const checklistsDir = path.join(root, 'checklists');
    const patternFiles = await fg('*.md', { cwd: patternsDir, absolute: true });
    const checklistFiles = await fg('*.md', { cwd: checklistsDir, absolute: true });
    const errors = [];
    const seenIds = new Set();
    console.log(chalk.bold('\n🔍 Validating content...\n'));
    // Validate patterns
    console.log(chalk.blue(`Checking ${patternFiles.length} patterns...`));
    for (const file of patternFiles) {
        const fileErrors = validateFile(file, 'pattern', seenIds);
        errors.push(...fileErrors);
    }
    // Validate checklists
    console.log(chalk.blue(`Checking ${checklistFiles.length} checklists...`));
    for (const file of checklistFiles) {
        const fileErrors = validateFile(file, 'checklist', seenIds);
        errors.push(...fileErrors);
    }
    const result = {
        errors,
        warnings: [],
        stats: {
            patterns: patternFiles.length,
            checklists: checklistFiles.length,
            totalErrors: errors.length
        }
    };
    // Print results
    if (errors.length === 0) {
        console.log(chalk.green('\n✅ All content validated successfully!'));
        console.log(chalk.dim(`   Patterns: ${result.stats.patterns}`));
        console.log(chalk.dim(`   Checklists: ${result.stats.checklists}`));
    }
    else {
        console.log(chalk.red(`\n❌ Found ${errors.length} validation errors:\n`));
        // Group errors by file
        const errorsByFile = new Map();
        for (const error of errors) {
            const existing = errorsByFile.get(error.file) || [];
            existing.push(error);
            errorsByFile.set(error.file, existing);
        }
        for (const [file, fileErrors] of errorsByFile) {
            console.log(chalk.yellow(`  ${file}:`));
            for (const error of fileErrors) {
                console.log(chalk.red(`    - ${error.message}`));
            }
        }
    }
    return result;
}
// CLI command
export async function validateCommand() {
    const result = await validateContent();
    if (result.errors.length > 0) {
        process.exit(1);
    }
}
// Run if called directly
if (import.meta.url === `file://${__filename}`) {
    validateCommand();
}
//# sourceMappingURL=validate-content.js.map