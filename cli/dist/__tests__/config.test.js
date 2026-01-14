import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
// Import from source files directly for testing
const { loadConfig, validateConfig, createConfigFile, findConfigFile, DEFAULT_CONFIG } = await import('../lib/config.js');
const { ConfigError } = await import('../lib/errors.js');
describe('Config', () => {
    let tempDir;
    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bek-test-'));
    });
    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });
    describe('findConfigFile', () => {
        it('should return null when no config exists', () => {
            const result = findConfigFile(tempDir);
            expect(result).toBeNull();
        });
        it('should find bek.config.json', () => {
            const configPath = path.join(tempDir, 'bek.config.json');
            fs.writeFileSync(configPath, JSON.stringify({ name: 'test' }));
            const result = findConfigFile(tempDir);
            expect(result).toBe(configPath);
        });
        it('should find .bekrc', () => {
            const configPath = path.join(tempDir, '.bekrc');
            fs.writeFileSync(configPath, JSON.stringify({ name: 'test' }));
            const result = findConfigFile(tempDir);
            expect(result).toBe(configPath);
        });
    });
    describe('validateConfig', () => {
        it('should pass with valid config', () => {
            const config = { ...DEFAULT_CONFIG };
            expect(() => validateConfig(config)).not.toThrow();
        });
        it('should throw on invalid logLevel', () => {
            const config = { ...DEFAULT_CONFIG, logLevel: 'invalid' };
            expect(() => validateConfig(config)).toThrow(ConfigError);
        });
        it('should throw on invalid adapter', () => {
            const config = {
                ...DEFAULT_CONFIG,
                features: { adapters: ['invalid-adapter'] }
            };
            expect(() => validateConfig(config)).toThrow(ConfigError);
        });
    });
    describe('createConfigFile', () => {
        it('should create JSON config file', () => {
            const configPath = createConfigFile(tempDir, { name: 'test-project' }, 'json');
            expect(fs.existsSync(configPath)).toBe(true);
            const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            expect(content.name).toBe('test-project');
        });
        it('should create JS config file', () => {
            const configPath = createConfigFile(tempDir, { name: 'test-project' }, 'js');
            expect(fs.existsSync(configPath)).toBe(true);
            expect(configPath.endsWith('.js')).toBe(true);
        });
    });
    describe('loadConfig', () => {
        it('should return defaults when no config exists', async () => {
            const originalCwd = process.cwd();
            process.chdir(tempDir);
            try {
                const config = await loadConfig();
                expect(config.patternsDir).toBe(DEFAULT_CONFIG.patternsDir);
            }
            finally {
                process.chdir(originalCwd);
            }
        });
        it('should load and merge with defaults', async () => {
            const configPath = path.join(tempDir, 'bek.config.json');
            fs.writeFileSync(configPath, JSON.stringify({ name: 'custom' }));
            const config = await loadConfig(configPath);
            expect(config.name).toBe('custom');
            expect(config.patternsDir).toBe(DEFAULT_CONFIG.patternsDir);
        });
        it('should throw on invalid JSON', async () => {
            const configPath = path.join(tempDir, 'bek.config.json');
            fs.writeFileSync(configPath, '{ invalid json }');
            await expect(loadConfig(configPath)).rejects.toThrow(ConfigError);
        });
    });
});
//# sourceMappingURL=config.test.js.map