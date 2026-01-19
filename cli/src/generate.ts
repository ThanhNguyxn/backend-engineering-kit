/**
 * BEK Architecture Generator
 * Similar to UI UX Pro Max's Design System Generator
 * Generates complete backend architecture recommendations based on industry
 */
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import yaml from 'yaml';
import logger from './lib/logger.js';
import { CLIError } from './lib/errors.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// TYPES
// =============================================================================

export interface IndustryRule {
    id: string;
    name: string;
    description: string;
    architecture: {
        pattern: string;
        database: string;
        caching: string;
        queue: string;
    };
    security_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    compliance: string[];
    required_patterns: string[];
    recommended_patterns: string[];
    anti_patterns: string[];
    checklist: string;
    key_decisions: Array<{
        question: string;
        options: Array<{
            name: string;
            when: string;
        }>;
    }>;
}

export interface GenerateOptions {
    industry?: string;
    stack?: string;
    projectName?: string;
    persist?: boolean;
    format?: 'ascii' | 'markdown' | 'json';
    output?: string;
}

export interface ArchitectureDecision {
    projectName: string;
    industry: IndustryRule;
    stack: string;
    timestamp: string;
    patterns: {
        required: string[];
        recommended: string[];
    };
    antiPatterns: string[];
    checklist: string;
}

// =============================================================================
// LOAD RULES
// =============================================================================

function loadIndustryRules(): Map<string, IndustryRule> {
    // Try multiple paths
    const possiblePaths = [
        path.resolve(__dirname, '../.shared/production-backend-kit/rules/industry-rules.yaml'),
        path.resolve(__dirname, '../../.shared/production-backend-kit/rules/industry-rules.yaml'),
        path.resolve(process.cwd(), '.shared/production-backend-kit/rules/industry-rules.yaml'),
        path.resolve(process.cwd(), '.backend-kit/rules/industry-rules.yaml'),
    ];
    
    let rulesPath: string | null = null;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            rulesPath = p;
            break;
        }
    }
    
    if (!rulesPath) {
        throw new CLIError(
            'Industry rules not found',
            'RULES_NOT_FOUND',
            1,
            'Run `bek sync` to update your kit or check your installation'
        );
    }
    
    const content = fs.readFileSync(rulesPath, 'utf-8');
    const data = yaml.parse(content);
    
    const rules = new Map<string, IndustryRule>();
    for (const [key, rule] of Object.entries(data.industries || {})) {
        rules.set(key, rule as IndustryRule);
        // Also map by id
        rules.set((rule as IndustryRule).id, rule as IndustryRule);
    }
    
    return rules;
}

// =============================================================================
// INDUSTRY DETECTION
// =============================================================================

const INDUSTRY_KEYWORDS: Record<string, string[]> = {
    'fintech': ['payment', 'bank', 'finance', 'money', 'transaction', 'wallet', 'crypto', 'trading', 'stripe', 'paypal'],
    'healthcare': ['health', 'medical', 'patient', 'clinic', 'hospital', 'doctor', 'hipaa', 'phi', 'fhir', 'hl7'],
    'ecommerce': ['shop', 'store', 'cart', 'checkout', 'product', 'inventory', 'order', 'marketplace', 'shopify'],
    'saas_b2b': ['saas', 'b2b', 'enterprise', 'tenant', 'subscription', 'multi-tenant', 'billing'],
    'micro_saas': ['micro', 'solo', 'indie', 'simple', 'mvp', 'bootstrap', 'side-project'],
    'realtime_gaming': ['game', 'realtime', 'multiplayer', 'websocket', 'live', 'chat', 'socket.io', 'phaser'],
    'iot_edge': ['iot', 'device', 'sensor', 'edge', 'embedded', 'mqtt', 'raspberry', 'arduino'],
    'ai_ml_platform': ['ai', 'ml', 'model', 'inference', 'training', 'llm', 'gpt', 'openai', 'langchain', 'tensorflow'],
    'developer_tools': ['api', 'sdk', 'developer', 'platform', 'integration', 'webhook', 'cli', 'npm', 'package'],
};

// Package.json dependency to industry mapping
const DEPENDENCY_INDUSTRY_MAP: Record<string, string> = {
    'stripe': 'fintech',
    '@stripe/stripe-js': 'fintech',
    'braintree': 'fintech',
    'paypal-rest-sdk': 'fintech',
    'shopify-api-node': 'ecommerce',
    'woocommerce-api': 'ecommerce',
    'socket.io': 'realtime_gaming',
    'ws': 'realtime_gaming',
    'mqtt': 'iot_edge',
    'johnny-five': 'iot_edge',
    'langchain': 'ai_ml_platform',
    '@anthropic-ai/sdk': 'ai_ml_platform',
    'openai': 'ai_ml_platform',
    '@tensorflow/tfjs': 'ai_ml_platform',
    'fhir': 'healthcare',
    'hl7': 'healthcare',
};

export function detectIndustry(query: string): string | null {
    const lowerQuery = query.toLowerCase();
    
    let bestMatch: string | null = null;
    let bestScore = 0;
    
    for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
        const score = keywords.filter(kw => lowerQuery.includes(kw)).length;
        if (score > bestScore) {
            bestScore = score;
            bestMatch = industry;
        }
    }
    
    return bestMatch;
}

/**
 * Detect industry from package.json in current directory
 */
export function detectIndustryFromProject(targetDir: string = process.cwd()): {
    industry: string | null;
    confidence: 'high' | 'medium' | 'low';
    signals: string[];
} {
    const signals: string[] = [];
    let industryScores: Record<string, number> = {};
    
    const pkgPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            
            // Check name and description
            const nameDesc = `${pkg.name || ''} ${pkg.description || ''}`.toLowerCase();
            const fromName = detectIndustry(nameDesc);
            if (fromName) {
                industryScores[fromName] = (industryScores[fromName] || 0) + 2;
                signals.push(`Package name/description suggests ${fromName}`);
            }
            
            // Check dependencies
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
            for (const [dep, industry] of Object.entries(DEPENDENCY_INDUSTRY_MAP)) {
                if (allDeps[dep]) {
                    industryScores[industry] = (industryScores[industry] || 0) + 3;
                    signals.push(`Dependency "${dep}" suggests ${industry}`);
                }
            }
            
            // Check keywords
            if (pkg.keywords && Array.isArray(pkg.keywords)) {
                const keywords = pkg.keywords.join(' ').toLowerCase();
                const fromKeywords = detectIndustry(keywords);
                if (fromKeywords) {
                    industryScores[fromKeywords] = (industryScores[fromKeywords] || 0) + 1;
                    signals.push(`Keywords suggest ${fromKeywords}`);
                }
            }
        } catch (e) {
            // Ignore parse errors
        }
    }
    
    // Check README.md
    const readmePath = path.join(targetDir, 'README.md');
    if (fs.existsSync(readmePath)) {
        try {
            const readme = fs.readFileSync(readmePath, 'utf-8').toLowerCase();
            const fromReadme = detectIndustry(readme.substring(0, 2000)); // First 2000 chars
            if (fromReadme) {
                industryScores[fromReadme] = (industryScores[fromReadme] || 0) + 1;
                signals.push(`README.md content suggests ${fromReadme}`);
            }
        } catch (e) {
            // Ignore read errors
        }
    }
    
    // Find best match
    let bestIndustry: string | null = null;
    let bestScore = 0;
    for (const [industry, score] of Object.entries(industryScores)) {
        if (score > bestScore) {
            bestScore = score;
            bestIndustry = industry;
        }
    }
    
    // Determine confidence
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (bestScore >= 4) confidence = 'high';
    else if (bestScore >= 2) confidence = 'medium';
    
    return {
        industry: bestIndustry,
        confidence,
        signals
    };
}

// =============================================================================
// ARCHITECTURE GENERATOR
// =============================================================================

export function generateArchitecture(options: GenerateOptions): ArchitectureDecision {
    const rules = loadIndustryRules();
    
    // Detect or use provided industry
    let industryKey = options.industry;
    if (!industryKey && options.projectName) {
        industryKey = detectIndustry(options.projectName) || 'saas_b2b';
    }
    industryKey = industryKey || 'saas_b2b';
    
    const industry = rules.get(industryKey);
    if (!industry) {
        throw new CLIError(
            `Unknown industry: ${industryKey}`,
            'UNKNOWN_INDUSTRY',
            1,
            `Available: ${Array.from(rules.keys()).filter(k => !k.includes('-')).join(', ')}`
        );
    }
    
    return {
        projectName: options.projectName || 'My Project',
        industry,
        stack: options.stack || 'node-express',
        timestamp: new Date().toISOString(),
        patterns: {
            required: industry.required_patterns,
            recommended: industry.recommended_patterns,
        },
        antiPatterns: industry.anti_patterns,
        checklist: industry.checklist,
    };
}

// =============================================================================
// OUTPUT FORMATTERS
// =============================================================================

export function formatAscii(decision: ArchitectureDecision): string {
    const { industry, projectName, stack, patterns, antiPatterns } = decision;
    const width = 90;
    const line = '+' + '-'.repeat(width - 2) + '+';
    const emptyLine = '|' + ' '.repeat(width - 2) + '|';
    
    const pad = (text: string, len: number = width - 4): string => {
        if (text.length > len) return text.substring(0, len - 3) + '...';
        return text + ' '.repeat(len - text.length);
    };
    
    const lines: string[] = [
        line,
        `|  TARGET: ${pad(projectName + ' - RECOMMENDED BACKEND ARCHITECTURE', width - 14)}|`,
        line,
        emptyLine,
        `|  INDUSTRY: ${pad(industry.name, width - 15)}|`,
        `|     Security Level: ${pad(industry.security_level, width - 24)}|`,
        `|     Compliance: ${pad(industry.compliance.join(', '), width - 20)}|`,
        emptyLine,
        `|  ARCHITECTURE PATTERN: ${pad(industry.architecture.pattern, width - 27)}|`,
        `|     Database: ${pad(industry.architecture.database, width - 18)}|`,
        `|     Caching: ${pad(industry.architecture.caching, width - 17)}|`,
        `|     Queue: ${pad(industry.architecture.queue, width - 14)}|`,
        emptyLine,
        `|  REQUIRED PATTERNS:${' '.repeat(width - 23)}|`,
    ];
    
    for (const pattern of patterns.required.slice(0, 6)) {
        lines.push(`|     • ${pad(pattern, width - 10)}|`);
    }
    if (patterns.required.length > 6) {
        lines.push(`|     + ${pad(`${patterns.required.length - 6} more...`, width - 10)}|`);
    }
    
    lines.push(emptyLine);
    lines.push(`|  RECOMMENDED PATTERNS:${' '.repeat(width - 26)}|`);
    
    for (const pattern of patterns.recommended.slice(0, 3)) {
        lines.push(`|     • ${pad(pattern, width - 10)}|`);
    }
    
    lines.push(emptyLine);
    lines.push(`|  ANTI-PATTERNS (AVOID):${' '.repeat(width - 27)}|`);
    
    for (const ap of antiPatterns.slice(0, 4)) {
        lines.push(`|     ✗ ${pad(ap, width - 10)}|`);
    }
    
    lines.push(emptyLine);
    lines.push(`|  PRE-DELIVERY CHECKLIST:${' '.repeat(width - 28)}|`);
    lines.push(`|     Run: bek gate --checklist ${pad(decision.checklist, width - 35)}|`);
    
    // Key decisions
    if (industry.key_decisions && industry.key_decisions.length > 0) {
        lines.push(emptyLine);
        lines.push(`|  KEY DECISIONS:${' '.repeat(width - 19)}|`);
        for (const kd of industry.key_decisions.slice(0, 2)) {
            lines.push(`|     Q: ${pad(kd.question, width - 11)}|`);
            for (const opt of kd.options.slice(0, 2)) {
                lines.push(`|        → ${pad(opt.name, width - 13)}|`);
            }
        }
    }
    
    lines.push(emptyLine);
    lines.push(line);
    
    return lines.join('\n');
}

export function formatMarkdown(decision: ArchitectureDecision): string {
    const { industry, projectName, stack, patterns, antiPatterns, timestamp } = decision;
    
    return `# Backend Architecture: ${projectName}

> Generated by BEK on ${new Date(timestamp).toLocaleDateString()}

## Industry Profile

| Attribute | Value |
|-----------|-------|
| **Industry** | ${industry.name} |
| **Security Level** | ${industry.security_level} |
| **Compliance** | ${industry.compliance.join(', ')} |
| **Stack** | ${stack} |

## Architecture Pattern

\`\`\`
${industry.architecture.pattern}
\`\`\`

### Technology Choices

- **Database**: ${industry.architecture.database}
- **Caching**: ${industry.architecture.caching}
- **Queue**: ${industry.architecture.queue}

## Required Patterns

${patterns.required.map(p => `- [ ] \`${p}\` - Review and implement`).join('\n')}

## Recommended Patterns

${patterns.recommended.map(p => `- [ ] \`${p}\``).join('\n')}

## Anti-Patterns to Avoid

${antiPatterns.map(ap => `- ⚠️ ${ap}`).join('\n')}

## Key Decisions

${industry.key_decisions?.map(kd => `
### ${kd.question}

${kd.options.map(opt => `- **${opt.name}**: ${opt.when}`).join('\n')}
`).join('\n') || 'No specific decisions documented.'}

## Quality Gate

Run the following checklist before deployment:

\`\`\`bash
bek gate --checklist ${decision.checklist}
\`\`\`

---

*This architecture decision record was generated by [Backend Engineering Kit](https://github.com/ThanhNguyxn/backend-engineering-kit)*
`;
}

// =============================================================================
// PERSIST TO FILE
// =============================================================================

export function persistArchitecture(
    decision: ArchitectureDecision,
    targetDir: string,
    page?: string
): string {
    const archDir = path.join(targetDir, 'architecture');
    fs.mkdirSync(archDir, { recursive: true });
    
    const markdown = formatMarkdown(decision);
    
    if (page) {
        // Page-specific override
        const pagesDir = path.join(archDir, 'modules');
        fs.mkdirSync(pagesDir, { recursive: true });
        const filePath = path.join(pagesDir, `${page}.md`);
        fs.writeFileSync(filePath, markdown);
        return filePath;
    } else {
        // Master file
        const filePath = path.join(archDir, 'ARCHITECTURE.md');
        fs.writeFileSync(filePath, markdown);
        return filePath;
    }
}

// =============================================================================
// CLI COMMAND
// =============================================================================

export interface GenerateCommandOptions {
    industry?: string;
    stack?: string;
    project?: string;
    persist?: boolean;
    format?: 'ascii' | 'markdown' | 'json';
    module?: string;
    target?: string;
    json?: boolean;
}

export async function generateCommand(options: GenerateCommandOptions = {}): Promise<void> {
    const format = options.json ? 'json' : (options.format || 'ascii');
    const target = path.resolve(options.target || '.');
    
    if (format !== 'json') {
        logger.header('🏗️  Backend Architecture Generator');
    }
    
    const decision = generateArchitecture({
        industry: options.industry,
        stack: options.stack,
        projectName: options.project,
        format: format as 'ascii' | 'markdown' | 'json',
    });
    
    // Output based on format
    if (format === 'json') {
        console.log(JSON.stringify(decision, null, 2));
        return;
    }
    
    if (format === 'ascii') {
        console.log(formatAscii(decision));
    } else {
        console.log(formatMarkdown(decision));
    }
    
    // Persist if requested
    if (options.persist) {
        const filePath = persistArchitecture(decision, target, options.module);
        logger.newline();
        logger.success(`Architecture saved to: ${filePath}`);
    }
    
    if (format === 'ascii') {
        logger.newline();
        logger.info(`Run ${chalk.cyan('bek generate --format markdown --persist')} to save as file`);
    }
}

// =============================================================================
// LIST INDUSTRIES
// =============================================================================

export function listIndustries(): void {
    const rules = loadIndustryRules();
    
    logger.header('📋 Available Industries');
    
    const seen = new Set<string>();
    for (const [key, rule] of rules.entries()) {
        if (seen.has(rule.id)) continue;
        seen.add(rule.id);
        
        console.log(`  ${chalk.cyan(rule.id.padEnd(20))} ${rule.name}`);
        console.log(`  ${' '.repeat(20)} ${chalk.dim(rule.description)}`);
        console.log();
    }
}

// =============================================================================
// DETECT COMMAND
// =============================================================================

export interface DetectOptions {
    target?: string;
    json?: boolean;
    suggest?: boolean;
}

export async function detectCommand(options: DetectOptions = {}): Promise<void> {
    const target = path.resolve(options.target || '.');
    
    if (!options.json) {
        logger.header('🔍 Industry Detection');
    }
    
    const result = detectIndustryFromProject(target);
    
    if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    
    if (!result.industry) {
        logger.warn('Could not detect industry from project');
        logger.info('Run with a project name: bek generate --project "My Payment App"');
        return;
    }
    
    const confidenceColor = result.confidence === 'high' ? chalk.green 
        : result.confidence === 'medium' ? chalk.yellow 
        : chalk.red;
    
    logger.newline();
    console.log(`  ${chalk.bold('Detected Industry:')} ${chalk.cyan(result.industry)}`);
    console.log(`  ${chalk.bold('Confidence:')} ${confidenceColor(result.confidence)}`);
    logger.newline();
    
    console.log(chalk.bold('  Signals:'));
    for (const signal of result.signals) {
        console.log(`    • ${signal}`);
    }
    
    if (options.suggest) {
        logger.newline();
        logger.info(`Suggested command:`);
        console.log(chalk.cyan(`  bek generate --industry ${result.industry} --persist`));
    }
}
