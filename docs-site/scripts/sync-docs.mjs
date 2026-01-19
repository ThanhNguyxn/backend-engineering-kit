#!/usr/bin/env node
/**
 * Docs Sync Script
 * Syncs canonical Markdown docs from repo root into docs-site/src/content/docs/
 * 
 * Usage:
 *   node scripts/sync-docs.mjs         # Sync docs
 *   node scripts/sync-docs.mjs --check # Check if docs are in sync (for CI)
 *   node scripts/sync-docs.mjs --clean # Remove all generated files
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, rmSync } from 'fs';
import { join, dirname, basename, relative, extname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Normalize path to use forward slashes (cross-platform consistency)
 */
function normalizePath(p) {
    return p.replace(/\\/g, '/');
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const DOCS_SITE = join(__dirname, '..');
const CONTENT_DIR = join(DOCS_SITE, 'src/content/docs');


// Load config
const config = JSON.parse(readFileSync(join(DOCS_SITE, 'docs-sync.config.json'), 'utf-8'));

const GENERATED_MARKER = '<!-- AUTO-GENERATED -->';
const GENERATED_FILES_MANIFEST = join(DOCS_SITE, '.generated-docs.json');

/**
 * Simple glob implementation using fs
 */
function simpleGlob(pattern, cwd) {
    const parts = pattern.split('/');
    const results = [];

    function walk(dir, patternParts) {
        if (patternParts.length === 0) return;

        const current = patternParts[0];
        const remaining = patternParts.slice(1);

        if (!existsSync(dir)) return;

        if (current === '**') {
            // Recursive match
            const entries = readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath, patternParts); // Keep ** for subdirs
                    walk(fullPath, remaining); // Try to match next pattern
                } else if (remaining.length === 0 || matchPattern(entry.name, remaining[0])) {
                    results.push(fullPath);
                }
            }
        } else if (current.includes('*')) {
            // Wildcard match
            const entries = readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (matchPattern(entry.name, current)) {
                    const fullPath = join(dir, entry.name);
                    if (remaining.length === 0) {
                        if (entry.isFile()) results.push(fullPath);
                    } else if (entry.isDirectory()) {
                        walk(fullPath, remaining);
                    }
                }
            }
        } else {
            // Exact match
            const fullPath = join(dir, current);
            if (existsSync(fullPath)) {
                if (remaining.length === 0) {
                    if (statSync(fullPath).isFile()) results.push(fullPath);
                } else if (statSync(fullPath).isDirectory()) {
                    walk(fullPath, remaining);
                }
            }
        }
    }

    walk(cwd, parts);
    return results;
}

function matchPattern(name, pattern) {
    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
    return regex.test(name);
}

/**
 * Extract or generate frontmatter with generated:true flag
 */
function ensureFrontmatter(content, source, filename) {
    // Normalize path for cross-platform consistency
    const normalizedSource = normalizePath(source);
    const hasFrontmatter = content.startsWith('---');
    const editWarning = `
:::caution[Auto-generated]
This file is auto-generated from \`${normalizedSource}\`. Do not edit directly.
:::
`;

    if (hasFrontmatter) {
        // Parse existing frontmatter and add generated flag
        const endIndex = content.indexOf('---', 3);
        if (endIndex > 0) {
            let frontmatter = content.slice(0, endIndex);
            const body = content.slice(endIndex + 3);
            // Add generated: true to existing frontmatter
            frontmatter = frontmatter.trim() + '\ngenerated: true\n---';
            return frontmatter + `\n${GENERATED_MARKER}\n<!-- Source: ${normalizedSource} -->${editWarning}` + body;
        }
    }

    // Generate frontmatter from content
    const h1Match = content.match(/^#\s+(.+)$/m);
    const title = h1Match ? h1Match[1] : filename.replace(/\.md$/, '').replace(/-/g, ' ');

    // Extract first paragraph as description
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const description = lines[0]?.slice(0, 160) || `Documentation for ${title}`;

    const frontmatter = `---
title: "${title}"
description: "${description.replace(/"/g, '\\"')}"
generated: true
---

${GENERATED_MARKER}
<!-- Source: ${normalizedSource} -->
${editWarning}
`;

    // Remove the H1 if we extracted it for the title
    let body = content;
    if (h1Match) {
        body = content.replace(/^#\s+.+\n?/, '');
    }

    return frontmatter + body;
}

/**
 * Fix relative links for new location
 */
function fixRelativeLinks(content, sourcePath, destPath) {
    // Fix .md links to use Starlight slug format
    return content.replace(/\]\(([^)]+\.md)\)/g, (match, link) => {
        if (link.startsWith('http')) return match;
        // Convert to Starlight-compatible link
        const slug = link.replace(/\.md$/, '/');
        return `](${slug})`;
    });
}

/**
 * Load manifest of previously generated files
 */
function loadManifest() {
    if (existsSync(GENERATED_FILES_MANIFEST)) {
        return JSON.parse(readFileSync(GENERATED_FILES_MANIFEST, 'utf-8'));
    }
    return { files: [] };
}

/**
 * Save manifest of generated files
 */
function saveManifest(manifest) {
    writeFileSync(GENERATED_FILES_MANIFEST, JSON.stringify(manifest, null, 2));
}

/**
 * Main sync function
 */
function syncDocs(options = {}) {
    const { check = false, clean = false } = options;
    const manifest = loadManifest();
    const newFiles = [];
    const changes = [];

    if (clean) {
        console.log('🧹 Cleaning generated files...');
        for (const file of manifest.files) {
            const fullPath = join(CONTENT_DIR, file);
            if (existsSync(fullPath)) {
                unlinkSync(fullPath);
                console.log(`  Removed: ${file}`);
            }
        }
        saveManifest({ files: [] });
        console.log('✅ Clean complete');
        return true;
    }

    console.log('📚 Syncing docs...\n');

    for (const source of config.sources) {
        const files = simpleGlob(source.glob, ROOT);

        for (const filePath of files) {
            const relativePath = relative(ROOT, filePath);
            const filename = source.rename || basename(filePath);
            const destDir = join(CONTENT_DIR, source.dest);
            const destPath = join(destDir, filename);
            const destRelative = relative(CONTENT_DIR, destPath);

            // Skip if in preserveManual list
            if (config.preserveManual.includes(destRelative)) {
                console.log(`  ⏭️  Skipping (manual): ${destRelative}`);
                continue;
            }

            // Read source
            let content = readFileSync(filePath, 'utf-8');

            // Add frontmatter and marker
            content = ensureFrontmatter(content, relativePath, filename);

            // Fix relative links
            content = fixRelativeLinks(content, filePath, destPath);

            // Ensure dest directory exists
            if (!existsSync(destDir)) {
                mkdirSync(destDir, { recursive: true });
            }

            // Check mode: compare with existing
            if (check) {
                if (existsSync(destPath)) {
                    const existing = readFileSync(destPath, 'utf-8');
                    if (existing !== content) {
                        changes.push({ file: destRelative, status: 'modified' });
                    }
                } else {
                    changes.push({ file: destRelative, status: 'missing' });
                }
            } else {
                // Write file
                writeFileSync(destPath, content);
                console.log(`  ✅ Synced: ${relativePath} → ${destRelative}`);
            }

            newFiles.push(destRelative);
        }
    }

    // Clean up stale files (files in old manifest but not in new)
    const staleFiles = manifest.files.filter(f => !newFiles.includes(f));
    for (const stale of staleFiles) {
        const fullPath = join(CONTENT_DIR, stale);
        if (existsSync(fullPath)) {
            // Only remove if it has our generated marker
            const content = readFileSync(fullPath, 'utf-8');
            if (content.includes(GENERATED_MARKER)) {
                if (check) {
                    changes.push({ file: stale, status: 'stale' });
                } else {
                    unlinkSync(fullPath);
                    console.log(`  🗑️  Removed stale: ${stale}`);
                }
            }
        }
    }

    if (check) {
        if (changes.length > 0) {
            console.log('\n❌ Docs are out of sync:\n');
            for (const change of changes) {
                console.log(`  ${change.status}: ${change.file}`);
            }
            console.log('\nRun `npm run sync:docs` to sync.');
            return false;
        } else {
            console.log('✅ Docs are in sync');
            return true;
        }
    }

    // Save new manifest
    saveManifest({ files: newFiles, lastSync: new Date().toISOString() });

    console.log(`\n✅ Synced ${newFiles.length} files`);
    return true;
}

// CLI
const args = process.argv.slice(2);
const check = args.includes('--check');
const clean = args.includes('--clean');

const success = syncDocs({ check, clean });
process.exit(success ? 0 : 1);
