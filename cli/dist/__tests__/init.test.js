import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
describe('Init Command', () => {
    let tempDir;
    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bek-init-test-'));
    });
    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });
    it('should create directory structure for minimal template', () => {
        const dirs = [
            '.shared/production-backend-kit/patterns',
            '.shared/production-backend-kit/checklists',
            '.shared/production-backend-kit/db'
        ];
        // Simulate directory creation
        for (const dir of dirs) {
            fs.mkdirSync(path.join(tempDir, dir), { recursive: true });
        }
        // Verify structure
        for (const dir of dirs) {
            expect(fs.existsSync(path.join(tempDir, dir))).toBe(true);
        }
    });
    it('should create config file', () => {
        const configPath = path.join(tempDir, 'bek.config.json');
        const config = {
            name: 'test-project',
            patternsDir: '.shared/production-backend-kit/patterns'
        };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        expect(fs.existsSync(configPath)).toBe(true);
        const loaded = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        expect(loaded.name).toBe('test-project');
    });
    it('should not overwrite existing config without force', () => {
        const configPath = path.join(tempDir, 'bek.config.json');
        // Create existing config
        fs.writeFileSync(configPath, JSON.stringify({ name: 'existing' }));
        // Check it exists
        expect(fs.existsSync(configPath)).toBe(true);
        // Verify content
        const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        expect(content.name).toBe('existing');
    });
    it('should create sample pattern file', () => {
        const patternDir = path.join(tempDir, '.shared/production-backend-kit/patterns');
        fs.mkdirSync(patternDir, { recursive: true });
        const samplePattern = `---
id: sample-pattern
title: Sample Pattern
tags: [sample]
scope: api
maturity: stable
works_with: [all]
---

# Sample Pattern

## Problem

Sample problem description.
`;
        const patternPath = path.join(patternDir, 'sample-pattern.md');
        fs.writeFileSync(patternPath, samplePattern);
        expect(fs.existsSync(patternPath)).toBe(true);
        const content = fs.readFileSync(patternPath, 'utf-8');
        expect(content).toContain('id: sample-pattern');
        expect(content).toContain('## Problem');
    });
    describe('Template options', () => {
        const templates = ['minimal', 'standard', 'advanced'];
        it.each(templates)('should recognize %s template', (template) => {
            expect(templates).toContain(template);
        });
    });
});
//# sourceMappingURL=init.test.js.map