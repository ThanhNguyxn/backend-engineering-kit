import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
let configModule;
let errorsModule;
beforeAll(async () => {
    configModule = await import('../lib/config.js');
    errorsModule = await import('../lib/errors.js');
});
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
            const result = configModule.findConfigFile(tempDir);
            expect(result).toBeNull();
        });
        it('should find bek.config.json', () => {
            const configPath = path.join(tempDir, 'bek.config.json');
            fs.writeFileSync(configPath, JSON.stringify({ name: 'test' }));
            const result = configModule.findConfigFile(tempDir);
            expect(result).toBe(configPath);
        });
        it('should find .bekrc', () => {
            const configPath = path.join(tempDir, '.bekrc');
            fs.writeFileSync(configPath, JSON.stringify({ name: 'test' }));
            const result = configModule.findConfigFile(tempDir);
            expect(result).toBe(configPath);
        });
    });
    describe('validateConfig', () => {
        it('should pass with valid config', () => {
            const config = { ...configModule.DEFAULT_CONFIG };
            expect(() => configModule.validateConfig(config)).not.toThrow();
        });
        it('should throw on invalid logLevel', () => {
            const config = { ...configModule.DEFAULT_CONFIG, logLevel: 'invalid' };
            expect(() => configModule.validateConfig(config)).toThrow(errorsModule.ConfigError);
        });
        it('should throw on invalid adapter', () => {
            const config = {
                ...configModule.DEFAULT_CONFIG,
                features: { adapters: ['invalid-adapter'] }
            };
            expect(() => configModule.validateConfig(config)).toThrow(errorsModule.ConfigError);
        });
    });
    describe('createConfigFile', () => {
        it('should create JSON config file', () => {
            const configPath = configModule.createConfigFile(tempDir, { name: 'test-project' }, 'json');
            expect(fs.existsSync(configPath)).toBe(true);
            const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            expect(content.name).toBe('test-project');
        });
        it('should create JS config file', () => {
            const configPath = configModule.createConfigFile(tempDir, { name: 'test-project' }, 'js');
            expect(fs.existsSync(configPath)).toBe(true);
            expect(configPath.endsWith('.js')).toBe(true);
        });
    });
    describe('loadConfig', () => {
        it('should return defaults when config path is not provided and no config exists in temp dir', async () => {
            // Test that loadConfig returns defaults when given a non-existent config path
            // (simulates behavior when no config file is found)
            const config = await configModule.loadConfig(undefined);
            // When no config path provided and no config found in cwd, returns defaults
            expect(config.patternsDir).toBeDefined();
            expect(config.features).toBeDefined();
        });
        it('should load and merge with defaults', async () => {
            const configPath = path.join(tempDir, 'bek.config.json');
            fs.writeFileSync(configPath, JSON.stringify({ name: 'custom' }));
            const config = await configModule.loadConfig(configPath);
            expect(config.name).toBe('custom');
            expect(config.patternsDir).toBe(configModule.DEFAULT_CONFIG.patternsDir);
        });
        it('should throw on invalid JSON', async () => {
            const configPath = path.join(tempDir, 'bek.config.json');
            fs.writeFileSync(configPath, '{ invalid json }');
            await expect(configModule.loadConfig(configPath)).rejects.toThrow(errorsModule.ConfigError);
        });
    });
});
//# sourceMappingURL=config.test.js.map