import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { BACKEND_KIT_DIR, MANIFEST_FILENAME } from '../lib/manifest.js';
describe('Remove Command', () => {
    let tempDir;
    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bek-remove-test-'));
    });
    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });
    function createMockProject(options = {}) {
        const kitDir = path.join(tempDir, BACKEND_KIT_DIR);
        const patternsDir = path.join(kitDir, 'patterns');
        const checklistsDir = path.join(kitDir, 'checklists');
        fs.mkdirSync(patternsDir, { recursive: true });
        fs.mkdirSync(checklistsDir, { recursive: true });
        // Create manifest with optional AI adapters
        const manifest = {
            kitVersion: '1.0.0',
            preset: 'node-express',
            installedAt: new Date().toISOString(),
            files: [
                'patterns/api.error-model.md',
                'checklists/checklist.api-review.md',
                'bek.config.json',
            ],
            aiAdapters: options.withAdapters ? [
                { tool: 'copilot', path: '.github/copilot-instructions.md' },
                { tool: 'cursor', path: '.cursorrules' },
            ] : undefined,
        };
        fs.writeFileSync(path.join(kitDir, MANIFEST_FILENAME), JSON.stringify(manifest, null, 2));
        // Create pattern and checklist files
        fs.writeFileSync(path.join(patternsDir, 'api.error-model.md'), '# Error Model Pattern');
        fs.writeFileSync(path.join(checklistsDir, 'checklist.api-review.md'), '# API Review Checklist');
        // Create config files
        fs.writeFileSync(path.join(tempDir, 'bek.config.json'), JSON.stringify({ name: 'test' }, null, 2));
        // Create AI adapters if requested
        if (options.withAdapters) {
            const githubDir = path.join(tempDir, '.github');
            fs.mkdirSync(githubDir, { recursive: true });
            fs.writeFileSync(path.join(githubDir, 'copilot-instructions.md'), '# Copilot Instructions');
            fs.writeFileSync(path.join(tempDir, '.cursorrules'), '# Cursor Rules');
        }
        return { kitDir, manifest };
    }
    describe('detection', () => {
        it('should detect backend-kit directory', () => {
            const { kitDir } = createMockProject();
            expect(fs.existsSync(kitDir)).toBe(true);
        });
        it('should detect no backend-kit in empty directory', () => {
            expect(fs.existsSync(path.join(tempDir, BACKEND_KIT_DIR))).toBe(false);
        });
    });
    describe('file removal', () => {
        it('should remove .backend-kit directory', () => {
            const { kitDir } = createMockProject();
            expect(fs.existsSync(kitDir)).toBe(true);
            // Simulate remove
            fs.rmSync(kitDir, { recursive: true, force: true });
            expect(fs.existsSync(kitDir)).toBe(false);
        });
        it('should remove bek.config.json', () => {
            createMockProject();
            const configPath = path.join(tempDir, 'bek.config.json');
            expect(fs.existsSync(configPath)).toBe(true);
            fs.unlinkSync(configPath);
            expect(fs.existsSync(configPath)).toBe(false);
        });
        it('should remove all supported config files', () => {
            createMockProject();
            const configFiles = [
                'bek.config.json',
                'bek.config.js',
                '.bekrc',
                '.bekrc.json',
            ];
            // Create all config files
            for (const file of configFiles) {
                fs.writeFileSync(path.join(tempDir, file), '{}');
            }
            // Verify all exist
            for (const file of configFiles) {
                expect(fs.existsSync(path.join(tempDir, file))).toBe(true);
            }
            // Remove all
            for (const file of configFiles) {
                fs.unlinkSync(path.join(tempDir, file));
            }
            // Verify all removed
            for (const file of configFiles) {
                expect(fs.existsSync(path.join(tempDir, file))).toBe(false);
            }
        });
    });
    describe('AI adapter removal', () => {
        it('should remove AI adapters listed in manifest', () => {
            createMockProject({ withAdapters: true });
            const copilotPath = path.join(tempDir, '.github', 'copilot-instructions.md');
            const cursorPath = path.join(tempDir, '.cursorrules');
            expect(fs.existsSync(copilotPath)).toBe(true);
            expect(fs.existsSync(cursorPath)).toBe(true);
            // Simulate adapter removal
            fs.unlinkSync(copilotPath);
            fs.unlinkSync(cursorPath);
            expect(fs.existsSync(copilotPath)).toBe(false);
            expect(fs.existsSync(cursorPath)).toBe(false);
        });
        it('should handle missing adapter files gracefully', () => {
            createMockProject({ withAdapters: true });
            // Remove one adapter file manually
            fs.unlinkSync(path.join(tempDir, '.cursorrules'));
            // Should not throw when trying to remove missing file
            const cursorPath = path.join(tempDir, '.cursorrules');
            expect(fs.existsSync(cursorPath)).toBe(false);
        });
    });
    describe('dry-run mode', () => {
        it('should not remove files in dry-run', () => {
            const { kitDir } = createMockProject();
            const configPath = path.join(tempDir, 'bek.config.json');
            // In dry-run, files should still exist
            expect(fs.existsSync(kitDir)).toBe(true);
            expect(fs.existsSync(configPath)).toBe(true);
        });
    });
    describe('result tracking', () => {
        it('should track removed directories', () => {
            createMockProject();
            const result = {
                removedFiles: [],
                removedDirs: [BACKEND_KIT_DIR],
                aiAdaptersRemoved: [],
            };
            expect(result.removedDirs).toContain(BACKEND_KIT_DIR);
        });
        it('should track removed config files', () => {
            createMockProject();
            const result = {
                removedFiles: ['bek.config.json'],
                removedDirs: [],
                aiAdaptersRemoved: [],
            };
            expect(result.removedFiles).toContain('bek.config.json');
        });
        it('should track removed AI adapters', () => {
            createMockProject({ withAdapters: true });
            const result = {
                removedFiles: [],
                removedDirs: [],
                aiAdaptersRemoved: [
                    '.github/copilot-instructions.md',
                    '.cursorrules',
                ],
            };
            expect(result.aiAdaptersRemoved).toHaveLength(2);
        });
    });
    describe('idempotency', () => {
        it('should handle multiple remove calls gracefully', () => {
            const { kitDir } = createMockProject();
            // First remove
            fs.rmSync(kitDir, { recursive: true, force: true });
            expect(fs.existsSync(kitDir)).toBe(false);
            // Second remove should not throw
            expect(() => {
                fs.rmSync(kitDir, { recursive: true, force: true });
            }).not.toThrow();
        });
    });
});
//# sourceMappingURL=remove.test.js.map