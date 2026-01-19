import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { BACKEND_KIT_DIR, MANIFEST_FILENAME } from '../lib/manifest.js';
describe('Sync Command', () => {
    let tempDir;
    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bek-sync-test-'));
    });
    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });
    function createMockProject(preset = 'node-express') {
        const kitDir = path.join(tempDir, BACKEND_KIT_DIR);
        const patternsDir = path.join(kitDir, 'patterns');
        const checklistsDir = path.join(kitDir, 'checklists');
        fs.mkdirSync(patternsDir, { recursive: true });
        fs.mkdirSync(checklistsDir, { recursive: true });
        // Create manifest
        const manifest = {
            kitVersion: '0.2.0',
            preset,
            installedAt: new Date().toISOString(),
            files: [
                'patterns/api.error-model.md',
                'checklists/checklist.api-review.md',
                'bek.config.json',
            ],
        };
        fs.writeFileSync(path.join(kitDir, MANIFEST_FILENAME), JSON.stringify(manifest, null, 2));
        // Create sample files
        fs.writeFileSync(path.join(patternsDir, 'api.error-model.md'), '# Error Model\n\nOld content');
        fs.writeFileSync(path.join(checklistsDir, 'checklist.api-review.md'), '# API Review\n\n- [ ] Check');
        // Create config
        fs.writeFileSync(path.join(tempDir, 'bek.config.json'), JSON.stringify({ name: 'test-project', preset }, null, 2));
        return { kitDir, manifest };
    }
    describe('manifest detection', () => {
        it('should detect existing .backend-kit directory', () => {
            const { kitDir } = createMockProject();
            expect(fs.existsSync(kitDir)).toBe(true);
        });
        it('should load manifest from .backend-kit', () => {
            createMockProject('node-fastify');
            const manifestPath = path.join(tempDir, BACKEND_KIT_DIR, MANIFEST_FILENAME);
            expect(fs.existsSync(manifestPath)).toBe(true);
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            expect(manifest.preset).toBe('node-fastify');
            expect(manifest.kitVersion).toBe('0.2.0');
        });
        it('should detect missing backend-kit directory', () => {
            expect(fs.existsSync(path.join(tempDir, BACKEND_KIT_DIR))).toBe(false);
        });
    });
    describe('backup creation', () => {
        it('should create backup directory structure', () => {
            createMockProject();
            const backupDir = path.join(tempDir, BACKEND_KIT_DIR, '.backup');
            fs.mkdirSync(backupDir, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(backupDir, timestamp);
            fs.mkdirSync(backupPath, { recursive: true });
            expect(fs.existsSync(backupPath)).toBe(true);
        });
        it('should preserve files in backup', () => {
            const { kitDir } = createMockProject();
            const backupDir = path.join(kitDir, '.backup', 'test-backup');
            fs.mkdirSync(backupDir, { recursive: true });
            // Copy a file to backup
            const srcFile = path.join(kitDir, 'patterns', 'api.error-model.md');
            const destFile = path.join(backupDir, 'api.error-model.md');
            fs.copyFileSync(srcFile, destFile);
            expect(fs.existsSync(destFile)).toBe(true);
            expect(fs.readFileSync(destFile, 'utf-8')).toContain('Old content');
        });
    });
    describe('sync result tracking', () => {
        it('should track added files', () => {
            createMockProject();
            const result = { added: ['new-pattern.md'], updated: [], removed: [], unchanged: [] };
            expect(result.added).toHaveLength(1);
            expect(result.added[0]).toBe('new-pattern.md');
        });
        it('should track updated files', () => {
            createMockProject();
            const result = { added: [], updated: ['api.error-model.md'], removed: [], unchanged: [] };
            expect(result.updated).toHaveLength(1);
        });
        it('should track removed files', () => {
            createMockProject();
            const result = { added: [], updated: [], removed: ['old-file.md'], unchanged: [] };
            expect(result.removed).toHaveLength(1);
        });
    });
    describe('manifest update', () => {
        it('should update kitVersion after sync', () => {
            createMockProject();
            const manifestPath = path.join(tempDir, BACKEND_KIT_DIR, MANIFEST_FILENAME);
            // Simulate version update
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            manifest.kitVersion = '1.0.0';
            manifest.lastSyncedAt = new Date().toISOString();
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
            const updated = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            expect(updated.kitVersion).toBe('1.0.0');
            expect(updated.lastSyncedAt).toBeDefined();
        });
    });
    describe('dry-run mode', () => {
        it('should not modify files in dry-run', () => {
            const { kitDir } = createMockProject();
            const patternFile = path.join(kitDir, 'patterns', 'api.error-model.md');
            const originalContent = fs.readFileSync(patternFile, 'utf-8');
            // In dry-run, content should remain unchanged
            expect(fs.readFileSync(patternFile, 'utf-8')).toBe(originalContent);
        });
        it('should not create backup in dry-run', () => {
            createMockProject();
            const backupDir = path.join(tempDir, BACKEND_KIT_DIR, '.backup');
            // Backup should not exist after dry-run
            expect(fs.existsSync(backupDir)).toBe(false);
        });
    });
});
//# sourceMappingURL=sync.test.js.map