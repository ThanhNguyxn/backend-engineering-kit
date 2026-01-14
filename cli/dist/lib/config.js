import fs from 'fs';
import path from 'path';
import { ConfigError } from './errors.js';
import logger from './logger.js';
const CONFIG_FILES = [
    'bek.config.json',
    'bek.config.js',
    'bek.config.mjs',
    '.bekrc',
    '.bekrc.json'
];
const DEFAULT_CONFIG = {
    patternsDir: '.shared/production-backend-kit/patterns',
    checklistsDir: '.shared/production-backend-kit/checklists',
    outputDir: '.shared/production-backend-kit/db',
    features: {
        search: true,
        validation: true,
        adapters: ['claude', 'cursor', 'copilot', 'codex']
    },
    logLevel: 'default'
};
export function findConfigFile(startDir = process.cwd()) {
    let currentDir = startDir;
    while (currentDir !== path.dirname(currentDir)) {
        for (const configFile of CONFIG_FILES) {
            const configPath = path.join(currentDir, configFile);
            if (fs.existsSync(configPath)) {
                return configPath;
            }
        }
        currentDir = path.dirname(currentDir);
    }
    return null;
}
export async function loadConfig(configPath) {
    const resolvedPath = configPath || findConfigFile();
    if (!resolvedPath) {
        logger.debug('No config file found, using defaults');
        return DEFAULT_CONFIG;
    }
    logger.debug(`Loading config from: ${resolvedPath}`);
    try {
        const ext = path.extname(resolvedPath);
        let userConfig;
        if (ext === '.json' || resolvedPath.endsWith('.bekrc')) {
            const content = fs.readFileSync(resolvedPath, 'utf-8');
            userConfig = JSON.parse(content);
        }
        else if (ext === '.js' || ext === '.mjs') {
            const module = await import(`file://${resolvedPath}`);
            userConfig = module.default || module;
        }
        else {
            throw new ConfigError(`Unsupported config format: ${ext}`);
        }
        // Validate and merge with defaults
        const config = validateConfig({ ...DEFAULT_CONFIG, ...userConfig });
        return config;
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            throw new ConfigError(`Invalid JSON in config file: ${resolvedPath}`, 'Check JSON syntax (missing commas, quotes, etc.)');
        }
        throw error;
    }
}
export function validateConfig(config) {
    const errors = [];
    // Validate logLevel
    const validLogLevels = ['silent', 'default', 'verbose', 'debug'];
    if (config.logLevel && !validLogLevels.includes(config.logLevel)) {
        errors.push(`Invalid logLevel: ${config.logLevel}. Must be one of: ${validLogLevels.join(', ')}`);
    }
    // Validate adapters
    const validAdapters = ['claude', 'cursor', 'copilot', 'codex'];
    if (config.features?.adapters) {
        for (const adapter of config.features.adapters) {
            if (!validAdapters.includes(adapter)) {
                errors.push(`Invalid adapter: ${adapter}. Must be one of: ${validAdapters.join(', ')}`);
            }
        }
    }
    if (errors.length > 0) {
        throw new ConfigError(`Config validation failed:\n  - ${errors.join('\n  - ')}`, 'Check your bek.config.json or .bekrc file');
    }
    return config;
}
export function createConfigFile(targetDir, config = {}, format = 'json') {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const filename = format === 'json' ? 'bek.config.json' : 'bek.config.js';
    const filePath = path.join(targetDir, filename);
    if (format === 'json') {
        fs.writeFileSync(filePath, JSON.stringify(finalConfig, null, 2));
    }
    else {
        const content = `export default ${JSON.stringify(finalConfig, null, 2)};\n`;
        fs.writeFileSync(filePath, content);
    }
    return filePath;
}
export { DEFAULT_CONFIG };
//# sourceMappingURL=config.js.map