/**
 * Manifest system for tracking BEK-generated files
 * Enables safe sync and remove operations
 */
import fs from 'fs';
import path from 'path';
import logger from './logger.js';
export const MANIFEST_FILENAME = '.bek-manifest.json';
export const BACKEND_KIT_DIR = '.backend-kit';
/**
 * Get the path to the manifest file
 */
export function getManifestPath(targetDir) {
    return path.join(targetDir, BACKEND_KIT_DIR, MANIFEST_FILENAME);
}
/**
 * Check if a BEK project exists in the target directory
 */
export function hasBackendKit(targetDir) {
    return fs.existsSync(path.join(targetDir, BACKEND_KIT_DIR));
}
/**
 * Load the manifest from a directory
 */
export function loadManifest(targetDir) {
    const manifestPath = getManifestPath(targetDir);
    if (!fs.existsSync(manifestPath)) {
        return null;
    }
    try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        return JSON.parse(content);
    }
    catch (error) {
        logger.warn(`Failed to parse manifest: ${error.message}`);
        return null;
    }
}
/**
 * Save the manifest to a directory
 */
export function saveManifest(targetDir, manifest) {
    const manifestPath = getManifestPath(targetDir);
    const manifestDir = path.dirname(manifestPath);
    if (!fs.existsSync(manifestDir)) {
        fs.mkdirSync(manifestDir, { recursive: true });
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}
/**
 * Create a new manifest
 */
export function createManifest(kitVersion, options) {
    return {
        kitVersion,
        preset: options.preset,
        template: options.template,
        installedAt: new Date().toISOString(),
        files: options.files || [],
        aiAdapters: options.aiAdapters,
    };
}
/**
 * Add files to the manifest
 */
export function addFilesToManifest(manifest, files) {
    for (const file of files) {
        if (!manifest.files.includes(file)) {
            manifest.files.push(file);
        }
    }
}
/**
 * Get CLI version from package.json
 */
export function getCliVersion() {
    try {
        const packagePath = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../../package.json');
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        return pkg.version || '0.0.0';
    }
    catch {
        return '0.0.0';
    }
}
//# sourceMappingURL=manifest.js.map