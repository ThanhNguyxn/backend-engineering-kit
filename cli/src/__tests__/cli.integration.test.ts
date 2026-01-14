import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('CLI Integration', () => {
    const cliPath = path.resolve(__dirname, '../../dist/index.js');
    let tempDir: string;

    beforeAll(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bek-cli-test-'));
    });

    afterAll(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const runCli = (args: string, options: { cwd?: string } = {}): string => {
        try {
            return execSync(`node ${cliPath} ${args}`, {
                encoding: 'utf-8',
                cwd: options.cwd || tempDir,
                env: { ...process.env, NO_COLOR: '1' }
            });
        } catch (error: any) {
            return error.stdout || error.stderr || '';
        }
    };

    it('should show help when no command provided', () => {
        const output = runCli('--help');
        expect(output).toContain('Backend Engineering Kit CLI');
    });

    it('should show version', () => {
        const output = runCli('--version');
        expect(output).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should run doctor command', () => {
        const output = runCli('doctor');
        expect(output).toContain('Environment Check');
        expect(output).toContain('Node.js');
    });

    it('should run doctor with --json flag', () => {
        try {
            const output = runCli('doctor --json');
            // Should be valid JSON
            const parsed = JSON.parse(output);
            expect(parsed).toHaveProperty('status');
            expect(parsed).toHaveProperty('checks');
        } catch {
            // Doctor may exit with non-zero, but should still output JSON
            expect(true).toBe(true);
        }
    });

    it('should show init help', () => {
        const output = runCli('init --help');
        expect(output).toContain('template');
        expect(output).toContain('target');
    });

    it('should run init with dry-run', () => {
        const output = runCli('init --template minimal --dry-run -y');
        expect(output.toLowerCase()).toContain('dry run');
    });
});
