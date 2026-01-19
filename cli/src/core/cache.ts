/**
 * Content-Addressable Cache - Inspired by Turborepo
 * Hash-based caching with TTL and fingerprint validation
 * 
 * @module core/cache
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Result, Ok, Err, Errors, BekError, tryCatch, isOk } from './result.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Cache entry metadata
 */
export interface CacheEntry {
  hash: string;
  createdAt: number;
  expiresAt: number;
  size: number;
  inputs: CacheInputs;
  outputs: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Inputs used to compute cache key
 */
export interface CacheInputs {
  registryVersion?: string;
  configHash?: string;
  patternIds?: string[];
  fileHashes?: Record<string, string>;
  envVars?: Record<string, string>;
  lockfileHash?: string;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  oldestEntry: number;
  newestEntry: number;
}

/**
 * Cache hit result
 */
export interface CacheHitResult {
  hit: boolean;
  entry?: CacheEntry;
  outputs?: string[];
  reason?: 'not_found' | 'expired' | 'hash_mismatch' | 'corrupted';
}

// =============================================================================
// HASH UTILITIES
// =============================================================================

/**
 * Create SHA256 hash of string
 */
export function hashString(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Create hash of file contents
 */
export function hashFile(filePath: string): Result<string, BekError> {
  return tryCatch(
    () => {
      const content = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
    },
    () => Errors.fileNotFound(filePath)
  );
}

/**
 * Create hash of multiple files
 */
export function hashFiles(filePaths: string[]): Result<Record<string, string>, BekError> {
  const hashes: Record<string, string> = {};
  
  for (const filePath of filePaths) {
    const result = hashFile(filePath);
    if (!isOk(result)) {
      // Skip missing files
      continue;
    }
    hashes[filePath] = result.value;
  }
  
  return Ok(hashes);
}

/**
 * Create cache key from inputs
 */
export function createCacheKey(inputs: CacheInputs): string {
  const normalized = JSON.stringify({
    registryVersion: inputs.registryVersion || '0',
    configHash: inputs.configHash || '0',
    patternIds: (inputs.patternIds || []).sort(),
    fileHashes: inputs.fileHashes || {},
    envVars: inputs.envVars || {},
    lockfileHash: inputs.lockfileHash || '0',
  });
  
  return hashString(normalized);
}

/**
 * Hash directory contents recursively
 */
export function hashDirectory(dirPath: string, exclude: string[] = []): Result<string, BekError> {
  return tryCatch(
    () => {
      const hash = crypto.createHash('sha256');
      
      const processDir = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
        
        for (const entry of entries) {
          if (exclude.includes(entry.name)) continue;
          
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(dirPath, fullPath);
          
          if (entry.isDirectory()) {
            processDir(fullPath);
          } else {
            const content = fs.readFileSync(fullPath);
            hash.update(relativePath);
            hash.update(content);
          }
        }
      };
      
      if (fs.existsSync(dirPath)) {
        processDir(dirPath);
      }
      
      return hash.digest('hex').slice(0, 16);
    },
    () => Errors.fileNotFound(dirPath)
  );
}

// =============================================================================
// CACHE MANAGER
// =============================================================================

/**
 * Content-addressable cache manager
 */
export class CacheManager {
  private cacheDir: string;
  private indexPath: string;
  private index: Map<string, CacheEntry> = new Map();
  private ttl: number;
  private maxSize: number;
  private hits: number = 0;
  private misses: number = 0;
  
  constructor(options: {
    cacheDir: string;
    ttl?: number;      // seconds
    maxSize?: number;  // bytes
  }) {
    this.cacheDir = options.cacheDir;
    this.indexPath = path.join(this.cacheDir, 'index.json');
    this.ttl = options.ttl || 86400; // 24 hours default
    this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB default
    
    this.loadIndex();
  }
  
  /**
   * Load cache index from disk
   */
  private loadIndex(): void {
    try {
      if (fs.existsSync(this.indexPath)) {
        const content = fs.readFileSync(this.indexPath, 'utf-8');
        const data = JSON.parse(content);
        this.index = new Map(Object.entries(data));
      }
    } catch {
      // Start with empty index
      this.index = new Map();
    }
  }
  
  /**
   * Save cache index to disk
   */
  private saveIndex(): void {
    fs.mkdirSync(this.cacheDir, { recursive: true });
    const data = Object.fromEntries(this.index);
    fs.writeFileSync(this.indexPath, JSON.stringify(data, null, 2));
  }
  
  /**
   * Get cache entry path
   */
  private getEntryPath(hash: string): string {
    // Use hash prefix for directory sharding (better filesystem performance)
    const prefix = hash.slice(0, 2);
    return path.join(this.cacheDir, prefix, hash);
  }
  
  /**
   * Check if cache has valid entry for inputs
   */
  get(inputs: CacheInputs): CacheHitResult {
    const hash = createCacheKey(inputs);
    const entry = this.index.get(hash);
    
    if (!entry) {
      this.misses++;
      return { hit: false, reason: 'not_found' };
    }
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.misses++;
      this.delete(hash);
      return { hit: false, reason: 'expired' };
    }
    
    // Verify files exist
    const entryPath = this.getEntryPath(hash);
    if (!fs.existsSync(entryPath)) {
      this.misses++;
      this.index.delete(hash);
      this.saveIndex();
      return { hit: false, reason: 'corrupted' };
    }
    
    this.hits++;
    return {
      hit: true,
      entry,
      outputs: entry.outputs,
    };
  }
  
  /**
   * Store entry in cache
   */
  set(
    inputs: CacheInputs,
    outputs: string[],
    metadata?: Record<string, unknown>
  ): Result<string, BekError> {
    const hash = createCacheKey(inputs);
    const entryPath = this.getEntryPath(hash);
    
    // Calculate total size of outputs
    let totalSize = 0;
    for (const outputPath of outputs) {
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        totalSize += stats.size;
      }
    }
    
    // Create entry
    const entry: CacheEntry = {
      hash,
      createdAt: Date.now(),
      expiresAt: Date.now() + (this.ttl * 1000),
      size: totalSize,
      inputs,
      outputs,
      metadata,
    };
    
    // Copy outputs to cache
    return tryCatch(
      () => {
        fs.mkdirSync(path.dirname(entryPath), { recursive: true });
        
        // Store outputs as JSON manifest + files
        const manifest = {
          entry,
          files: outputs.map(p => ({
            path: p,
            relativePath: path.relative(process.cwd(), p),
          })),
        };
        
        fs.writeFileSync(path.join(entryPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
        
        // Copy actual files
        for (const outputPath of outputs) {
          if (fs.existsSync(outputPath)) {
            const destPath = path.join(entryPath, 'files', path.basename(outputPath));
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(outputPath, destPath);
          }
        }
        
        // Update index
        this.index.set(hash, entry);
        this.saveIndex();
        
        // Prune if needed
        this.pruneIfNeeded();
        
        return hash;
      },
      (error) => Errors.filePermissionDenied(entryPath)
    );
  }
  
  /**
   * Restore cached outputs to target paths
   */
  restore(hash: string, targetDir: string = process.cwd()): Result<string[], BekError> {
    const entry = this.index.get(hash);
    if (!entry) {
      return Err(Errors.fileNotFound(`Cache entry: ${hash}`));
    }
    
    const entryPath = this.getEntryPath(hash);
    const manifestPath = path.join(entryPath, 'manifest.json');
    
    return tryCatch(
      () => {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const restored: string[] = [];
        
        for (const file of manifest.files) {
          const srcPath = path.join(entryPath, 'files', path.basename(file.path));
          const destPath = path.join(targetDir, file.relativePath);
          
          if (fs.existsSync(srcPath)) {
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(srcPath, destPath);
            restored.push(destPath);
          }
        }
        
        return restored;
      },
      () => Errors.fileNotFound(entryPath)
    );
  }
  
  /**
   * Delete cache entry
   */
  delete(hash: string): void {
    const entryPath = this.getEntryPath(hash);
    
    if (fs.existsSync(entryPath)) {
      fs.rmSync(entryPath, { recursive: true, force: true });
    }
    
    this.index.delete(hash);
    this.saveIndex();
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    if (fs.existsSync(this.cacheDir)) {
      fs.rmSync(this.cacheDir, { recursive: true, force: true });
    }
    
    this.index.clear();
    this.hits = 0;
    this.misses = 0;
  }
  
  /**
   * Prune expired entries
   */
  pruneExpired(): number {
    const now = Date.now();
    let pruned = 0;
    
    for (const [hash, entry] of this.index) {
      if (now > entry.expiresAt) {
        this.delete(hash);
        pruned++;
      }
    }
    
    return pruned;
  }
  
  /**
   * Prune if total size exceeds limit
   */
  pruneIfNeeded(): void {
    const stats = this.getStats();
    
    if (stats.totalSize <= this.maxSize) return;
    
    // Sort by creation time, oldest first
    const entries = Array.from(this.index.entries())
      .sort(([, a], [, b]) => a.createdAt - b.createdAt);
    
    let currentSize = stats.totalSize;
    const targetSize = this.maxSize * 0.8; // Prune to 80% of max
    
    for (const [hash, entry] of entries) {
      if (currentSize <= targetSize) break;
      
      currentSize -= entry.size;
      this.delete(hash);
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    let totalSize = 0;
    let oldest = Infinity;
    let newest = 0;
    
    for (const entry of this.index.values()) {
      totalSize += entry.size;
      oldest = Math.min(oldest, entry.createdAt);
      newest = Math.max(newest, entry.createdAt);
    }
    
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    
    return {
      totalEntries: this.index.size,
      totalSize,
      hitRate,
      oldestEntry: oldest === Infinity ? 0 : oldest,
      newestEntry: newest,
    };
  }
  
  /**
   * Check if inputs match cached entry
   */
  hasValidCache(inputs: CacheInputs): boolean {
    return this.get(inputs).hit;
  }
  
  /**
   * Get or compute value with caching
   */
  async getOrCompute<T>(
    inputs: CacheInputs,
    compute: () => Promise<{ value: T; outputs: string[] }>,
    options: { force?: boolean } = {}
  ): Promise<Result<{ value: T; cached: boolean }, BekError>> {
    // Check cache first
    if (!options.force) {
      const cacheResult = this.get(inputs);
      if (cacheResult.hit) {
        // Load cached value from manifest
        const entryPath = this.getEntryPath(cacheResult.entry!.hash);
        const manifestPath = path.join(entryPath, 'manifest.json');
        
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          return Ok({ value: manifest.entry.metadata?.value as T, cached: true });
        } catch {
          // Cache corrupted, recompute
        }
      }
    }
    
    // Compute value
    try {
      const { value, outputs } = await compute();
      
      // Store in cache
      this.set(inputs, outputs, { value });
      
      return Ok({ value, cached: false });
    } catch (error) {
      return Err(Errors.unknown(String(error), error as Error));
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let globalCache: CacheManager | null = null;

/**
 * Get global cache instance
 */
export function getCache(cacheDir?: string): CacheManager {
  if (!globalCache) {
    const defaultDir = path.join(process.cwd(), '.backend-kit', '.cache');
    globalCache = new CacheManager({ cacheDir: cacheDir || defaultDir });
  }
  return globalCache;
}

/**
 * Reset global cache (for testing)
 */
export function resetCache(): void {
  globalCache = null;
}

// =============================================================================
// FINGERPRINT UTILITIES
// =============================================================================

/**
 * Create fingerprint for pattern installation
 */
export function createPatternFingerprint(
  patternIds: string[],
  projectDir: string = process.cwd()
): CacheInputs {
  // Hash lockfile if exists
  const lockfiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb'];
  let lockfileHash: string | undefined;
  
  for (const lockfile of lockfiles) {
    const lockPath = path.join(projectDir, lockfile);
    const result = hashFile(lockPath);
    if (isOk(result)) {
      lockfileHash = result.value;
      break;
    }
  }
  
  // Hash config file
  const configFiles = ['bek.config.json', '.bekrc', '.bek/config.json'];
  let configHash: string | undefined;
  
  for (const configFile of configFiles) {
    const configPath = path.join(projectDir, configFile);
    const result = hashFile(configPath);
    if (isOk(result)) {
      configHash = result.value;
      break;
    }
  }
  
  return {
    patternIds: patternIds.sort(),
    lockfileHash,
    configHash,
    envVars: {
      NODE_ENV: process.env.NODE_ENV || 'development',
    },
  };
}

/**
 * Create fingerprint for registry fetch
 */
export function createRegistryFingerprint(registryUrl: string): CacheInputs {
  return {
    registryVersion: hashString(registryUrl + Date.now().toString().slice(0, -5)), // 10-second granularity
  };
}
