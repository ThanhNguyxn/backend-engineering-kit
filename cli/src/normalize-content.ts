import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import fg from 'fast-glob';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Scope mapping based on file prefix
const SCOPE_MAP: Record<string, string> = {
    'api': 'api',
    'db': 'database',
    'sec': 'security',
    'rel': 'reliability',
    'obs': 'observability',
    'checklist': 'mixed'
};

// Normalize checklist format: ensure "- [ ]" format
function normalizeChecklistFormat(content: string): string {
    // Convert "- item" to "- [ ] item" in checklist sections
    const lines = content.split('\n');
    let inChecklistSection = false;

    return lines.map(line => {
        // Detect checklist section
        if (/^##.*checklist/i.test(line)) {
            inChecklistSection = true;
            return line;
        }
        if (/^##/.test(line) && !/checklist/i.test(line)) {
            inChecklistSection = false;
            return line;
        }

        // Already has checkbox format, skip
        if (/^-\s+\[[ xX]\]/.test(line)) {
            return line;
        }

        // In checklist section, convert bullet to checkbox
        if (inChecklistSection && /^-\s+(?!\[)/.test(line) && !line.includes('http')) {
            return line.replace(/^-\s+/, '- [ ] ');
        }

        return line;
    }).join('\n');
}

// Normalize sources format: "Name — URL"
function normalizeSourcesFormat(content: string): string {
    const lines = content.split('\n');
    let inSourcesSection = false;

    return lines.map(line => {
        // Detect sources section
        if (/^##.*sources/i.test(line)) {
            inSourcesSection = true;
            return line;
        }
        if (/^##/.test(line) && !/sources/i.test(line)) {
            inSourcesSection = false;
            return line;
        }

        if (!inSourcesSection) return line;

        // Already correct format "- Name — URL"
        if (/^-\s+.+\s+—\s+https?:\/\//.test(line)) {
            return line;
        }

        // Format: "- Name: URL" -> "- Name — URL"
        const colonMatch = line.match(/^-\s+(.+?):\s*(https?:\/\/\S+)/);
        if (colonMatch) {
            return `- ${colonMatch[1].trim()} — ${colonMatch[2]}`;
        }

        // Format: just URL, try to extract name from URL
        const urlOnlyMatch = line.match(/^-\s*(https?:\/\/(\S+))/);
        if (urlOnlyMatch) {
            const url = urlOnlyMatch[1];
            // Extract domain name
            try {
                const domain = new URL(url).hostname.replace('www.', '');
                const name = domain.split('.')[0];
                const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
                return `- ${capitalizedName} — ${url}`;
            } catch {
                return line;
            }
        }

        return line;
    }).join('\n');
}

// Add missing frontmatter fields
function addMissingFrontmatter(
    frontmatter: Record<string, any>,
    filename: string,
    type: 'pattern' | 'checklist'
): Record<string, any> {
    const updated = { ...frontmatter };

    // Determine scope from filename prefix
    const prefix = filename.split('.')[0];
    if (!updated.scope) {
        updated.scope = SCOPE_MAP[prefix] || 'mixed';
    }

    // Add maturity if missing
    if (!updated.maturity) {
        updated.maturity = 'stable';
    }

    // Add works_with if missing (rename from stacks if exists)
    if (!updated.works_with) {
        if (updated.stacks) {
            updated.works_with = updated.stacks;
        } else {
            updated.works_with = ['all'];
        }
    }

    // Ensure arrays are arrays
    if (typeof updated.tags === 'string') {
        updated.tags = [updated.tags];
    }
    if (typeof updated.works_with === 'string') {
        updated.works_with = [updated.works_with];
    }

    return updated;
}

// Process a single file
function normalizeFile(filePath: string, type: 'pattern' | 'checklist', dryRun: boolean): boolean {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const { data: frontmatter, content: body } = matter(content);

        const filename = path.basename(filePath);

        // Update frontmatter
        const updatedFrontmatter = addMissingFrontmatter(frontmatter, filename, type);

        // Normalize content
        let normalizedBody = body;
        normalizedBody = normalizeChecklistFormat(normalizedBody);
        normalizedBody = normalizeSourcesFormat(normalizedBody);

        // Reconstruct file
        const newContent = matter.stringify(normalizedBody, updatedFrontmatter);

        // Check if anything changed
        if (content === newContent) {
            return false;
        }

        if (!dryRun) {
            fs.writeFileSync(filePath, newContent);
        }

        return true;
    } catch (error) {
        console.error(chalk.red(`Error processing ${filePath}:`), error);
        return false;
    }
}

// Main normalization function
export async function normalizeContent(baseDir?: string, dryRun: boolean = false): Promise<void> {
    const root = baseDir || path.resolve(__dirname, '../.shared/production-backend-kit');
    const patternsDir = path.join(root, 'patterns');
    const checklistsDir = path.join(root, 'checklists');

    const patternFiles = await fg('*.md', { cwd: patternsDir, absolute: true });
    const checklistFiles = await fg('*.md', { cwd: checklistsDir, absolute: true });

    console.log(chalk.bold('\n🔧 Normalizing content...\n'));

    if (dryRun) {
        console.log(chalk.yellow('Running in dry-run mode (no changes will be made)\n'));
    }

    let modifiedCount = 0;

    // Process patterns
    console.log(chalk.blue(`Processing ${patternFiles.length} patterns...`));
    for (const file of patternFiles) {
        const modified = normalizeFile(file, 'pattern', dryRun);
        if (modified) {
            modifiedCount++;
            console.log(chalk.green(`  ✓ ${path.basename(file)}`));
        }
    }

    // Process checklists
    console.log(chalk.blue(`\nProcessing ${checklistFiles.length} checklists...`));
    for (const file of checklistFiles) {
        const modified = normalizeFile(file, 'checklist', dryRun);
        if (modified) {
            modifiedCount++;
            console.log(chalk.green(`  ✓ ${path.basename(file)}`));
        }
    }

    console.log(chalk.bold(`\n✅ Normalization complete!`));
    console.log(chalk.dim(`   Modified: ${modifiedCount} files`));

    if (dryRun && modifiedCount > 0) {
        console.log(chalk.yellow('\n   Run without --dry-run to apply changes'));
    }
}

// CLI command
export async function normalizeCommand(dryRun: boolean = false): Promise<void> {
    await normalizeContent(undefined, dryRun);
}

// Run if called directly
if (import.meta.url === `file://${__filename}`) {
    const dryRun = process.argv.includes('--dry-run');
    normalizeCommand(dryRun);
}
