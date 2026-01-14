import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import logger from '../lib/logger.js';
import { CLIError } from '../lib/errors.js';
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
}

interface LintResult {
    issues: LintIssue[];
    stats: {
        files: number;
        errors: number;
        warnings: number;
    };
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
                    message: `Missing required field: ${field}`
                });
            }
        }
        return issues;
    },

    'frontmatter-recommended': (file: string, frontmatter: Record<string, any>): LintIssue[] => {
        const issues: LintIssue[] = [];
        const recommended = ['scope', 'maturity', 'works_with'];

        for (const field of recommended) {
            if (!frontmatter[field]) {
                issues.push({
                    file,
                    level: 'warning',
                    rule: 'frontmatter-recommended',
                    message: `Missing recommended field: ${field}`
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
                        message: `Missing recommended heading: ## ${req}`
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
                    message: 'Sources section has no URLs'
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
                message: `ID should be lowercase with hyphens: ${id}`
            });
        }

        return issues;
    }
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
            message: `Failed to parse file: ${error}`
        });
    }

    return issues;
}

export async function lintContent(baseDir?: string): Promise<LintResult> {
    const root = baseDir || path.resolve(__dirname, '../../../.shared/production-backend-kit');
    const patternsDir = path.join(root, 'patterns');
    const checklistsDir = path.join(root, 'checklists');

    const patternFiles = await fg('*.md', { cwd: patternsDir, absolute: true });
    const checklistFiles = await fg('*.md', { cwd: checklistsDir, absolute: true });

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
            warnings
        }
    };
}

export async function lintCommand(options: LintOptions = {}): Promise<void> {
    logger.header('🔍 Linting content...');

    const result = await lintContent();

    if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.stats.errors > 0 ? 1 : 0);
        return;
    }

    logger.info(`Checked ${result.stats.files} files`);

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
            const level = issue.level === 'error' ? chalk.red(issue.level) : chalk.yellow(issue.level);
            console.log(`  ${icon} ${issue.message} ${chalk.dim(`[${issue.rule}]`)}`);
        }
        console.log();
    }

    logger.log(`Found ${chalk.red(result.stats.errors + ' errors')} and ${chalk.yellow(result.stats.warnings + ' warnings')}`);

    process.exit(result.stats.errors > 0 ? 1 : 0);
}
