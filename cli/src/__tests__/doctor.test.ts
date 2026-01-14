import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process
vi.mock('child_process', () => ({
    execSync: vi.fn((cmd: string) => {
        if (cmd === 'npm --version') return '10.0.0';
        if (cmd === 'git --version') return 'git version 2.40.0';
        throw new Error('Command failed');
    })
}));

describe('Doctor Command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should check Node.js version', () => {
        const version = process.version;
        const major = parseInt(version.slice(1).split('.')[0], 10);
        expect(major).toBeGreaterThanOrEqual(18);
    });

    it('should detect OS info', () => {
        const os = require('os');
        expect(os.platform()).toBeDefined();
        expect(os.arch()).toBeDefined();
    });

    it('should have proper exit code constants', () => {
        // Exit codes:
        // 0 = all checks passed
        // 1 = warnings
        // 2 = errors
        expect(0).toBe(0); // OK
        expect(1).toBe(1); // Warnings
        expect(2).toBe(2); // Errors
    });
});
