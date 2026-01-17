import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import logger from '../lib/logger.js';
import matter from 'gray-matter';
import fg from 'fast-glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface LintOptions {
    fix?: boolean;
    json?: boolean;
}

interface LintIssue {
    file: string;
    line?: number;
    level: 'error' | 'warning';
    rule: string;
    message: string;
    fixable?: boolean;
}

interface LintResult {
    issues: LintIssue[];
    stats: {
        files: number;
        errors: number;
        warnings: number;
        fixed: number;
    };
}

// Scope inference from filename
function inferScope(filePath: string): string {
    const basename = path.basename(filePath, '.md');

    if (basename.startsWith('api') || basename.startsWith('api.')) return 'api';
    if (basename.startsWith('db') || basename.startsWith('db.')) return 'database';
    if (basename.startsWith('sec') || basename.startsWith('sec.')) return 'security';
    if (basename.startsWith('rel') || basename.startsWith('rel.')) return 'reliability';
    if (basename.startsWith('obs') || basename.startsWith('obs.')) return 'observability';
    if (basename.includes('checklist')) {
        if (basename.includes('api')) return 'api';
        if (basename.includes('db')) return 'database';
        if (basename.includes('security')) return 'security';
        if (basename.includes('reliability')) return 'reliability';
        if (basename.includes('prod')) return 'deployment';
    }

    return 'api'; // default
}

// Level inference from content complexity
function inferLevel(content: string): string {
    const lower = content.toLowerCase();

    // Advanced indicators
    const advancedKeywords = ['circuit breaker', 'outbox', 'saga', 'cqrs', 'event sourcing', 'dlq', 'idempotency'];
    if (advancedKeywords.some(k => lower.includes(k))) return 'advanced';

    // Beginner indicators
    const beginnerKeywords = ['basic', 'simple', 'getting started', 'introduction', 'fundamentals'];
    if (beginnerKeywords.some(k => lower.includes(k))) return 'beginner';

    return 'intermediate';
}

// Maturity - default to stable for existing content
function inferMaturity(): string {
    return 'stable';
}

// Stacks - default to all
function inferStacks(): string[] {
    return ['all'];
}

// Lint rules
const RULES = {
    'frontmatter-required': (file: string, frontmatter: Record<string, any>): LintIssue[] => {
        const issues: LintIssue[] = [];
        const required = ['id', 'title', 'tags'];

        for (const field of required) {
            if (!frontmatter[field]) {
                issues.push({
                    file,
                    level: 'error',
                    rule: 'frontmatter-required',
                    message: `Missing required field: ${field}`,
                    fixable: false,
                });
            }
        }
        return issues;
    },

    'frontmatter-recommended': (file: string, frontmatter: Record<string, any>): LintIssue[] => {
        const issues: LintIssue[] = [];
        const recommended = ['scope', 'level', 'maturity', 'stacks'];

        for (const field of recommended) {
            if (!frontmatter[field]) {
                issues.push({
                    file,
                    level: 'warning',
                    rule: 'frontmatter-recommended',
                    message: `Missing recommended field: ${field}`,
                    fixable: true,
                });
            }
        }
        return issues;
    },

    'heading-structure': (file: string, content: string, type: 'pattern' | 'checklist'): LintIssue[] => {
        const issues: LintIssue[] = [];

        if (type === 'pattern') {
            const requiredHeadings = ['Problem', 'When to use', 'Solution'];
            const headings = content.match(/^##\s+(.+)$/gm) || [];
            const headingTexts = headings.map(h => h.replace(/^##\s+/, '').toLowerCase());

            for (const req of requiredHeadings) {
                if (!headingTexts.some(h => h.includes(req.toLowerCase()))) {
                    issues.push({
                        file,
                        level: 'warning',
                        rule: 'heading-structure',
                        message: `Missing recommended heading: ## ${req}`,
                        fixable: false,
                    });
                }
            }
        }

        return issues;
    },

    'sources-valid': (file: string, content: string): LintIssue[] => {
        const issues: LintIssue[] = [];
        const sourcesMatch = content.match(/##\s+Sources[\s\S]*?(?=##|$)/i);

        if (sourcesMatch) {
            const sourcesSection = sourcesMatch[0];
            const urls = sourcesSection.match(/https?:\/\/[^\s)]+/g) || [];

            if (urls.length === 0) {
                issues.push({
                    file,
                    level: 'warning',
                    rule: 'sources-valid',
                    message: 'Sources section has no URLs',
                    fixable: false,
                });
            }
        }

        return issues;
    },

    'id-format': (file: string, frontmatter: Record<string, any>): LintIssue[] => {
        const issues: LintIssue[] = [];
        const id = frontmatter.id;

        if (id && !/^[a-z][a-z0-9-]*$/.test(id)) {
            issues.push({
                file,
                level: 'warning',
                rule: 'id-format',
                message: `ID should be lowercase with hyphens: ${id}`,
                fixable: false,
            });
        }

        return issues;
    },
};

function lintFile(filePath: string, type: 'pattern' | 'checklist'): LintIssue[] {
    const issues: LintIssue[] = [];
    const relativePath = path.relative(process.cwd(), filePath);

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const { data: frontmatter, content: body } = matter(content);

        // Run rules
        issues.push(...RULES['frontmatter-required'](relativePath, frontmatter));
        issues.push(...RULES['frontmatter-recommended'](relativePath, frontmatter));
        issues.push(...RULES['heading-structure'](relativePath, body, type));
        issues.push(...RULES['sources-valid'](relativePath, body));
        issues.push(...RULES['id-format'](relativePath, frontmatter));
    } catch (error) {
        issues.push({
            file: relativePath,
            level: 'error',
            rule: 'parse-error',
            message: `Failed to parse file: ${error}`,
        });
    }

    return issues;
}

function fixFile(filePath: string): boolean {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const { data: frontmatter, content: body } = matter(content);
        let modified = false;

        // Fix scope
        if (!frontmatter.scope) {
            frontmatter.scope = inferScope(filePath);
            modified = true;
        }

        // Fix level
        if (!frontmatter.level) {
            frontmatter.level = inferLevel(body);
            modified = true;
        }

        // Fix maturity
        if (!frontmatter.maturity) {
            frontmatter.maturity = inferMaturity();
            modified = true;
        }

        // Fix stacks
        if (!frontmatter.stacks) {
            frontmatter.stacks = inferStacks();
            modified = true;
        }

        if (modified) {
            const newContent = matter.stringify(body, frontmatter);
            fs.writeFileSync(filePath, newContent, 'utf-8');
        }

        return modified;
    } catch {
        return false;
    }
}

export async function lintContent(baseDir?: string, fix = false): Promise<LintResult> {
    const root = baseDir || path.resolve(__dirname, '../../../.shared/production-backend-kit');
    const patternsDir = path.join(root, 'patterns');
    const checklistsDir = path.join(root, 'checklists');

    const patternFiles = await fg('*.md', { cwd: patternsDir, absolute: true });
    const checklistFiles = await fg('*.md', { cwd: checklistsDir, absolute: true });

    let fixed = 0;

    // Fix files first if requested
    if (fix) {
        for (const file of [...patternFiles, ...checklistFiles]) {
            if (fixFile(file)) {
                fixed++;
            }
        }
    }

    // Then lint
    const issues: LintIssue[] = [];

    for (const file of patternFiles) {
        issues.push(...lintFile(file, 'pattern'));
    }

    for (const file of checklistFiles) {
        issues.push(...lintFile(file, 'checklist'));
    }

    const errors = issues.filter(i => i.level === 'error').length;
    const warnings = issues.filter(i => i.level === 'warning').length;

    return {
        issues,
        stats: {
            files: patternFiles.length + checklistFiles.length,
            errors,
            warnings,
            fixed,
        },
    };
}

export async function lintCommand(options: LintOptions = {}): Promise<void> {
    logger.header('🔍 Linting content...');

    if (options.fix) {
        logger.info('Running with --fix: auto-fixing missing fields...');
    }

    const result = await lintContent(undefined, options.fix);

    if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        // Exit codes: 0 = ok, 1 = warnings only, 2 = errors
        if (result.stats.errors > 0) process.exit(2);
        if (result.stats.warnings > 0) process.exit(1);
        process.exit(0);
        return;
    }

    logger.info(`Checked ${result.stats.files} files`);

    if (options.fix && result.stats.fixed > 0) {
        logger.success(`Fixed ${result.stats.fixed} files`);
    }

    if (result.issues.length === 0) {
        logger.success('No issues found!');
        process.exit(0);
        return;
    }

    // Group by file
    const byFile = new Map<string, LintIssue[]>();
    for (const issue of result.issues) {
        const existing = byFile.get(issue.file) || [];
        existing.push(issue);
        byFile.set(issue.file, existing);
    }

    logger.newline();

    for (const [file, fileIssues] of byFile) {
        console.log(chalk.bold(file));
        for (const issue of fileIssues) {
            const icon = issue.level === 'error' ? chalk.red('✖') : chalk.yellow('⚠');
            const fixBadge = issue.fixable ? chalk.dim(' (fixable)') : '';
            console.log(`  ${icon} ${issue.message} ${chalk.dim(`[${issue.rule}]`)}${fixBadge}`);
        }
        console.log();
    }

    logger.log(
        `Found ${chalk.red(result.stats.errors + ' errors')} and ${chalk.yellow(result.stats.warnings + ' warnings')}`
    );

    if (result.stats.warnings > 0 && !options.fix) {
        logger.log(chalk.dim('  Run with --fix to auto-fix recommended fields'));
    }

    // Exit codes: 0 = ok, 1 = warnings only, 2 = errors
    if (result.stats.errors > 0) process.exit(2);
    if (result.stats.warnings > 0) process.exit(1);
    process.exit(0);
}
