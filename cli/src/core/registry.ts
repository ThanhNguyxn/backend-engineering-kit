/**
 * Registry System - Inspired by shadcn/ui
 * Namespaced registries with version pinning and community support
 * 
 * @module core/registry
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { Result, Ok, Err, Errors, BekError, tryCatch, tryCatchAsync, isOk } from './result.js';
import { CacheManager, createCacheKey, hashString } from './cache.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Pattern definition in registry
 */
export interface RegistryPattern {
  id: string;
  name: string;
  description: string;
  version: string;
  
  // Classification
  domain: string;
  scope: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  maturity: 'stable' | 'beta' | 'alpha' | 'deprecated';
  
  // Tags and compatibility
  tags: string[];
  stacks: string[];
  worksWithAll: boolean;
  
  // Dependencies
  dependsOn?: string[];
  recommends?: string[];
  conflictsWith?: string[];
  
  // Files
  files: Array<{
    path: string;
    type: 'markdown' | 'typescript' | 'yaml' | 'json';
    content?: string;  // Inline content
    url?: string;      // Remote content
  }>;
  
  // Metadata
  author?: string;
  license?: string;
  repository?: string;
  homepage?: string;
  
  // Stats
  downloads?: number;
  lastUpdated?: string;
}

/**
 * Checklist definition in registry
 */
export interface RegistryChecklist {
  id: string;
  name: string;
  description: string;
  version: string;
  
  // Classification
  scope: string;
  maturity: 'stable' | 'beta' | 'alpha';
  
  // Tags
  tags: string[];
  
  // Content
  items: Array<{
    text: string;
    critical?: boolean;
    category?: string;
  }>;
  
  // Files
  files?: Array<{
    path: string;
    type: string;
    content?: string;
    url?: string;
  }>;
}

/**
 * Registry manifest
 */
export interface RegistryManifest {
  name: string;
  namespace: string;
  version: string;
  description?: string;
  
  // URLs
  baseUrl: string;
  patternsUrl?: string;
  checklistsUrl?: string;
  
  // Content
  patterns: RegistryPattern[];
  checklists: RegistryChecklist[];
  
  // Metadata
  author?: string;
  license?: string;
  updatedAt?: string;
}

/**
 * Registry source configuration
 */
export interface RegistrySource {
  name: string;
  namespace: string;
  url: string;
  auth?: {
    type: 'token' | 'basic';
    token?: string;
    username?: string;
    password?: string;
  };
  priority: number;  // Higher = checked first
  enabled: boolean;
}

/**
 * Pattern reference with namespace
 */
export interface PatternRef {
  namespace: string;
  id: string;
  version?: string;
  full: string;  // @namespace/id@version
}

// =============================================================================
// PATTERN REFERENCE PARSER
// =============================================================================

/**
 * Parse pattern reference string
 * Formats:
 * - pattern-id
 * - @namespace/pattern-id
 * - @namespace/pattern-id@1.0.0
 */
export function parsePatternRef(ref: string): Result<PatternRef, BekError> {
  const normalized = ref.trim();
  
  // @namespace/id@version
  const fullMatch = normalized.match(/^@([^/]+)\/([^@]+)(?:@(.+))?$/);
  if (fullMatch) {
    return Ok({
      namespace: fullMatch[1],
      id: fullMatch[2],
      version: fullMatch[3],
      full: normalized,
    });
  }
  
  // Just id (use default namespace)
  if (!normalized.includes('/') && !normalized.startsWith('@')) {
    return Ok({
      namespace: 'bek',
      id: normalized.replace(/@.+$/, ''),
      version: normalized.includes('@') ? normalized.split('@')[1] : undefined,
      full: `@bek/${normalized}`,
    });
  }
  
  return Err(Errors.patternNotFound(ref, []));
}

/**
 * Format pattern reference to string
 */
export function formatPatternRef(ref: PatternRef, includeVersion: boolean = false): string {
  let result = `@${ref.namespace}/${ref.id}`;
  if (includeVersion && ref.version) {
    result += `@${ref.version}`;
  }
  return result;
}

// =============================================================================
// REGISTRY MANAGER
// =============================================================================

/**
 * Registry manager with multi-source support
 */
export class RegistryManager {
  private sources: Map<string, RegistrySource> = new Map();
  private manifests: Map<string, RegistryManifest> = new Map();
  private cache?: CacheManager;
  
  constructor(options?: {
    cache?: CacheManager;
    sources?: RegistrySource[];
  }) {
    this.cache = options?.cache;
    
    // Add default BEK registry
    this.addSource({
      name: 'Backend Engineering Kit',
      namespace: 'bek',
      url: 'https://registry.bekkit.dev',
      priority: 0,
      enabled: true,
    });
    
    // Add custom sources
    if (options?.sources) {
      for (const source of options.sources) {
        this.addSource(source);
      }
    }
  }
  
  /**
   * Add a registry source
   */
  addSource(source: RegistrySource): void {
    this.sources.set(source.namespace, source);
  }
  
  /**
   * Remove a registry source
   */
  removeSource(namespace: string): void {
    this.sources.delete(namespace);
    this.manifests.delete(namespace);
  }
  
  /**
   * Get all sources sorted by priority
   */
  getSources(): RegistrySource[] {
    return Array.from(this.sources.values())
      .filter(s => s.enabled)
      .sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Fetch registry manifest
   */
  async fetchManifest(namespace: string, options?: { force?: boolean }): Promise<Result<RegistryManifest, BekError>> {
    const source = this.sources.get(namespace);
    if (!source) {
      return Err(Errors.registryUnreachable(`Unknown namespace: ${namespace}`));
    }
    
    // Check cache
    if (!options?.force && this.manifests.has(namespace)) {
      return Ok(this.manifests.get(namespace)!);
    }
    
    // Check disk cache
    if (this.cache && !options?.force) {
      const cacheKey = { registryVersion: hashString(source.url + namespace) };
      const cached = this.cache.get(cacheKey);
      
      if (cached.hit) {
        const entryPath = path.join(this.cache['cacheDir'], cached.entry!.hash.slice(0, 2), cached.entry!.hash);
        const manifestPath = path.join(entryPath, 'manifest.json');
        
        try {
          const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          if (data.entry?.metadata?.manifest) {
            const manifest = data.entry.metadata.manifest as RegistryManifest;
            this.manifests.set(namespace, manifest);
            return Ok(manifest);
          }
        } catch {
          // Cache miss, fetch fresh
        }
      }
    }
    
    // Fetch from remote
    const result = await this.fetchRemoteManifest(source);
    
    if (isOk(result)) {
      this.manifests.set(namespace, result.value);
      
      // Store in cache
      if (this.cache) {
        const cacheKey = { registryVersion: hashString(source.url + namespace) };
        // Save to cache (simplified - just store manifest data)
      }
    }
    
    return result;
  }
  
  /**
   * Fetch manifest from remote URL
   */
  private async fetchRemoteManifest(source: RegistrySource): Promise<Result<RegistryManifest, BekError>> {
    const url = `${source.url}/registry.json`;
    
    return new Promise((resolve) => {
      const protocol = url.startsWith('https') ? https : http;
      
      const req = protocol.get(url, {
        headers: {
          'User-Agent': 'bek-cli/1.0',
          ...(source.auth?.token && { 'Authorization': `Bearer ${source.auth.token}` }),
        },
        timeout: 10000,
      }, (res) => {
        if (res.statusCode === 401 || res.statusCode === 403) {
          resolve(Err(Errors.registryUnreachable(`Authentication failed for ${source.namespace}`)));
          return;
        }
        
        if (res.statusCode === 429) {
          resolve(Err(Errors.registryRateLimited()));
          return;
        }
        
        if (res.statusCode !== 200) {
          resolve(Err(Errors.registryUnreachable(`HTTP ${res.statusCode} from ${source.url}`)));
          return;
        }
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const manifest = JSON.parse(data) as RegistryManifest;
            resolve(Ok(manifest));
          } catch (e) {
            resolve(Err(Errors.registryUnreachable(`Invalid JSON from ${source.url}`)));
          }
        });
      });
      
      req.on('error', (e) => {
        resolve(Err(Errors.registryUnreachable(`Network error: ${e.message}`)));
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve(Err(Errors.registryUnreachable(`Timeout fetching ${source.url}`)));
      });
    });
  }
  
  /**
   * Get pattern from any registry
   */
  async getPattern(ref: string | PatternRef): Promise<Result<RegistryPattern, BekError>> {
    // Parse reference
    const parsed = typeof ref === 'string' ? parsePatternRef(ref) : Ok(ref);
    if (!isOk(parsed)) return Err((parsed as { _tag: "Err"; error: BekError }).error);
    
    const { namespace, id, version } = parsed.value;
    
    // Fetch manifest
    const manifestResult = await this.fetchManifest(namespace);
    if (!isOk(manifestResult)) return manifestResult as Result<RegistryPattern, BekError>;
    
    const manifest = manifestResult.value;
    
    // Find pattern
    let pattern = manifest.patterns.find(p => p.id === id);
    
    // Check version if specified
    if (pattern && version && pattern.version !== version) {
      // Version mismatch - could implement version history here
      return Err(Errors.patternNotFound(
        `${id}@${version}`,
        manifest.patterns
          .filter(p => p.id === id)
          .map(p => `${p.id}@${p.version}`)
      ));
    }
    
    if (!pattern) {
      return Err(Errors.patternNotFound(
        id,
        manifest.patterns.map(p => p.id)
      ));
    }
    
    return Ok(pattern);
  }
  
  /**
   * Get checklist from any registry
   */
  async getChecklist(ref: string | PatternRef): Promise<Result<RegistryChecklist, BekError>> {
    const parsed = typeof ref === 'string' ? parsePatternRef(ref) : Ok(ref);
    if (!isOk(parsed)) return parsed as Result<RegistryChecklist, BekError>;
    
    const { namespace, id } = parsed.value;
    
    const manifestResult = await this.fetchManifest(namespace);
    if (!isOk(manifestResult)) return manifestResult as Result<RegistryChecklist, BekError>;
    
    const checklist = manifestResult.value.checklists.find(c => c.id === id);
    
    if (!checklist) {
      return Err(Errors.patternNotFound(
        id,
        manifestResult.value.checklists.map(c => c.id)
      ));
    }
    
    return Ok(checklist);
  }
  
  /**
   * Search patterns across all registries
   */
  async searchPatterns(query: {
    text?: string;
    domain?: string;
    tags?: string[];
    namespace?: string;
  }): Promise<Result<Array<RegistryPattern & { namespace: string }>, BekError>> {
    const results: Array<RegistryPattern & { namespace: string }> = [];
    const sources = query.namespace 
      ? [this.sources.get(query.namespace)].filter(Boolean) as RegistrySource[]
      : this.getSources();
    
    for (const source of sources) {
      const manifestResult = await this.fetchManifest(source.namespace);
      if (!isOk(manifestResult)) continue;
      
      const manifest = manifestResult.value;
      
      for (const pattern of manifest.patterns) {
        let matches = true;
        
        // Text search
        if (query.text) {
          const searchText = `${pattern.name} ${pattern.description} ${pattern.tags.join(' ')}`.toLowerCase();
          if (!searchText.includes(query.text.toLowerCase())) {
            matches = false;
          }
        }
        
        // Domain filter
        if (query.domain && pattern.domain !== query.domain) {
          matches = false;
        }
        
        // Tags filter
        if (query.tags && query.tags.length > 0) {
          const hasTag = query.tags.some(tag => pattern.tags.includes(tag));
          if (!hasTag) matches = false;
        }
        
        if (matches) {
          results.push({ ...pattern, namespace: source.namespace });
        }
      }
    }
    
    return Ok(results);
  }
  
  /**
   * List all patterns from a namespace
   */
  async listPatterns(namespace?: string): Promise<Result<Array<RegistryPattern & { namespace: string }>, BekError>> {
    return this.searchPatterns({ namespace });
  }
  
  /**
   * List all checklists from a namespace
   */
  async listChecklists(namespace?: string): Promise<Result<Array<RegistryChecklist & { namespace: string }>, BekError>> {
    const results: Array<RegistryChecklist & { namespace: string }> = [];
    const sources = namespace 
      ? [this.sources.get(namespace)].filter(Boolean) as RegistrySource[]
      : this.getSources();
    
    for (const source of sources) {
      const manifestResult = await this.fetchManifest(source.namespace);
      if (!isOk(manifestResult)) continue;
      
      for (const checklist of manifestResult.value.checklists) {
        results.push({ ...checklist, namespace: source.namespace });
      }
    }
    
    return Ok(results);
  }
  
  /**
   * Resolve pattern dependencies
   */
  async resolveDependencies(
    refs: (string | PatternRef)[],
    options?: { includeRecommended?: boolean }
  ): Promise<Result<Map<string, RegistryPattern>, BekError>> {
    const resolved = new Map<string, RegistryPattern>();
    const pending = [...refs];
    const visited = new Set<string>();
    
    while (pending.length > 0) {
      const ref = pending.shift()!;
      const refStr = typeof ref === 'string' ? ref : formatPatternRef(ref);
      
      if (visited.has(refStr)) continue;
      visited.add(refStr);
      
      const result = await this.getPattern(ref);
      if (!isOk(result)) {
        return result as Result<Map<string, RegistryPattern>, BekError>;
      }
      
      const pattern = result.value;
      resolved.set(pattern.id, pattern);
      
      // Add dependencies
      if (pattern.dependsOn) {
        for (const dep of pattern.dependsOn) {
          if (!visited.has(dep)) {
            pending.push(dep);
          }
        }
      }
      
      // Optionally add recommendations
      if (options?.includeRecommended && pattern.recommends) {
        for (const rec of pattern.recommends) {
          if (!visited.has(rec)) {
            pending.push(rec);
          }
        }
      }
    }
    
    return Ok(resolved);
  }
  
  /**
   * Download pattern files
   */
  async downloadPattern(
    ref: string | PatternRef,
    targetDir: string
  ): Promise<Result<string[], BekError>> {
    const result = await this.getPattern(ref);
    if (!isOk(result)) return result as Result<string[], BekError>;
    
    const pattern = result.value;
    const downloaded: string[] = [];
    
    for (const file of pattern.files) {
      const destPath = path.join(targetDir, file.path);
      
      // Ensure directory exists
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      
      if (file.content) {
        // Inline content
        fs.writeFileSync(destPath, file.content);
        downloaded.push(destPath);
      } else if (file.url) {
        // Remote content - fetch
        const fetchResult = await this.fetchFile(file.url);
        if (isOk(fetchResult)) {
          fs.writeFileSync(destPath, fetchResult.value);
          downloaded.push(destPath);
        }
      }
    }
    
    return Ok(downloaded);
  }
  
  /**
   * Fetch file content from URL
   */
  private async fetchFile(url: string): Promise<Result<string, BekError>> {
    return new Promise((resolve) => {
      const protocol = url.startsWith('https') ? https : http;
      
      const req = protocol.get(url, { timeout: 10000 }, (res) => {
        if (res.statusCode !== 200) {
          resolve(Err(Errors.registryUnreachable(`HTTP ${res.statusCode}`)));
          return;
        }
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(Ok(data)));
      });
      
      req.on('error', (e) => {
        resolve(Err(Errors.registryUnreachable(e.message)));
      });
    });
  }
  
  /**
   * Clear all cached manifests
   */
  clearCache(): void {
    this.manifests.clear();
    this.cache?.clear();
  }
}

// =============================================================================
// SINGLETON & FACTORY
// =============================================================================

let globalRegistry: RegistryManager | null = null;

/**
 * Get global registry instance
 */
export function getRegistry(): RegistryManager {
  if (!globalRegistry) {
    globalRegistry = new RegistryManager();
  }
  return globalRegistry;
}

/**
 * Reset registry (for testing)
 */
export function resetRegistry(): void {
  globalRegistry = null;
}

// =============================================================================
// LOCAL REGISTRY
// =============================================================================

/**
 * Load local registry from filesystem
 */
export function loadLocalRegistry(registryPath: string): Result<RegistryManifest, BekError> {
  return tryCatch(
    () => {
      const content = fs.readFileSync(registryPath, 'utf-8');
      
      // Support both JSON and YAML
      if (registryPath.endsWith('.yaml') || registryPath.endsWith('.yml')) {
        const yaml = require('yaml');
        return yaml.parse(content) as RegistryManifest;
      }
      
      return JSON.parse(content) as RegistryManifest;
    },
    (error) => Errors.fileNotFound(registryPath)
  );
}

/**
 * Build local registry from patterns directory
 */
export function buildLocalRegistry(
  patternsDir: string,
  checklistsDir: string
): Result<RegistryManifest, BekError> {
  return tryCatch(
    () => {
      const patterns: RegistryPattern[] = [];
      const checklists: RegistryChecklist[] = [];
      
      // Scan patterns
      if (fs.existsSync(patternsDir)) {
        const files = fs.readdirSync(patternsDir).filter(f => f.endsWith('.md'));
        
        for (const file of files) {
          const content = fs.readFileSync(path.join(patternsDir, file), 'utf-8');
          const pattern = parsePatternFile(file, content);
          if (pattern) patterns.push(pattern);
        }
      }
      
      // Scan checklists
      if (fs.existsSync(checklistsDir)) {
        const files = fs.readdirSync(checklistsDir).filter(f => f.endsWith('.md'));
        
        for (const file of files) {
          const content = fs.readFileSync(path.join(checklistsDir, file), 'utf-8');
          const checklist = parseChecklistFile(file, content);
          if (checklist) checklists.push(checklist);
        }
      }
      
      return {
        name: 'Local Registry',
        namespace: 'local',
        version: '1.0.0',
        baseUrl: 'file://' + path.resolve(patternsDir, '..'),
        patterns,
        checklists,
        updatedAt: new Date().toISOString(),
      };
    },
    (error) => Errors.unknown(`Failed to build local registry: ${error}`, error as Error)
  );
}

/**
 * Parse pattern markdown file to RegistryPattern
 */
function parsePatternFile(filename: string, content: string): RegistryPattern | null {
  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return null;
  
  try {
    const yaml = require('yaml');
    const frontmatter = yaml.parse(frontmatterMatch[1]);
    
    return {
      id: frontmatter.id || filename.replace('.md', ''),
      name: frontmatter.title || frontmatter.id,
      description: frontmatter.description || '',
      version: frontmatter.version || '1.0.0',
      domain: frontmatter.scope || 'general',
      scope: frontmatter.scope || 'general',
      level: frontmatter.level || 'intermediate',
      maturity: frontmatter.maturity || 'stable',
      tags: frontmatter.tags || [],
      stacks: frontmatter.works_with || ['all'],
      worksWithAll: frontmatter.works_with?.includes('all') ?? true,
      dependsOn: frontmatter.depends_on,
      recommends: frontmatter.recommends,
      files: [{
        path: `patterns/${filename}`,
        type: 'markdown',
        content,
      }],
    };
  } catch {
    return null;
  }
}

/**
 * Parse checklist markdown file to RegistryChecklist
 */
function parseChecklistFile(filename: string, content: string): RegistryChecklist | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return null;
  
  try {
    const yaml = require('yaml');
    const frontmatter = yaml.parse(frontmatterMatch[1]);
    
    // Extract checklist items from markdown
    const items: Array<{ text: string; critical?: boolean }> = [];
    const checklistMatch = content.match(/- \[[ x]\] .+/g);
    
    if (checklistMatch) {
      for (const line of checklistMatch) {
        const text = line.replace(/- \[[ x]\] /, '');
        const critical = text.includes('⚠️') || text.includes('CRITICAL');
        items.push({ text: text.replace(/⚠️|CRITICAL/g, '').trim(), critical });
      }
    }
    
    return {
      id: frontmatter.id || filename.replace('.md', ''),
      name: frontmatter.title || frontmatter.id,
      description: frontmatter.description || '',
      version: frontmatter.version || '1.0.0',
      scope: frontmatter.scope || 'general',
      maturity: frontmatter.maturity || 'stable',
      tags: frontmatter.tags || [],
      items,
      files: [{
        path: `checklists/${filename}`,
        type: 'markdown',
        content,
      }],
    };
  } catch {
    return null;
  }
}
