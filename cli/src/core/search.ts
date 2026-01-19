/**
 * Advanced Search Engine - Inspired by MiniSearch + Elasticsearch
 * Field boosting, fuzzy matching, domain-aware ranking, query parsing
 * 
 * @module core/search
 */
import MiniSearch, { SearchResult, Options as MiniSearchOptions } from 'minisearch';
import { Result, Ok, Err, Errors, BekError, isOk, tryCatch } from './result.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Searchable document structure
 */
export interface SearchDocument {
  id: string;
  title: string;
  description?: string;
  type: 'pattern' | 'checklist' | 'rule';
  domain: string;
  scope: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  maturity: 'stable' | 'beta' | 'alpha';
  tags: string[];
  stacks: string[];
  worksWithAll: boolean;
  content: string;
  sections?: string;
  checklistItems?: string;
  path: string;
  
  // For scoring
  popularity?: number;    // Usage count / downloads
  lastUpdated?: number;   // Timestamp
}

/**
 * Search query options
 */
export interface SearchQuery {
  text: string;
  
  // Filters
  domain?: string | string[];
  scope?: string | string[];
  level?: string | string[];
  maturity?: string | string[];
  tags?: string[];
  stacks?: string[];
  type?: 'pattern' | 'checklist' | 'rule';
  
  // Options
  limit?: number;
  offset?: number;
  fuzzy?: number | boolean;
  exact?: boolean;
  boost?: Record<string, number>;
  
  // Sorting
  sortBy?: 'relevance' | 'popularity' | 'recent' | 'alphabetical';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Search result item with scoring details
 */
export interface SearchResultItem {
  document: SearchDocument;
  score: number;
  matchedTerms: string[];
  highlights: Record<string, string[]>;
  scoreBreakdown?: {
    textMatch: number;
    fieldBoost: number;
    domainBoost: number;
    popularityBoost: number;
    recencyBoost: number;
  };
}

/**
 * Search response
 */
export interface SearchResponse {
  results: SearchResultItem[];
  total: number;
  query: SearchQuery;
  timing: number;
  suggestions?: string[];
  facets?: {
    domain: Record<string, number>;
    scope: Record<string, number>;
    level: Record<string, number>;
    tags: Record<string, number>;
  };
}

/**
 * Query parse result
 */
interface ParsedQuery {
  terms: string[];
  phrases: string[];
  required: string[];   // +term (must have)
  excluded: string[];   // -term (must not have)
  fields: Record<string, string>; // field:value
  fuzzy: boolean;
}

// =============================================================================
// DOMAIN CONFIGURATION
// =============================================================================

export const DOMAINS = {
  api: {
    name: 'API Design',
    prefixes: ['api-', 'api.'],
    keywords: ['rest', 'graphql', 'endpoint', 'validation', 'versioning'],
    description: 'REST/GraphQL APIs, validation, versioning',
  },
  db: {
    name: 'Database',
    prefixes: ['db-', 'db.'],
    keywords: ['sql', 'nosql', 'transaction', 'migration', 'query'],
    description: 'SQL, NoSQL, transactions, migrations',
  },
  sec: {
    name: 'Security',
    prefixes: ['sec-', 'sec.'],
    keywords: ['auth', 'encryption', 'secret', 'owasp', 'rbac', 'jwt'],
    description: 'Auth, encryption, secrets, OWASP',
  },
  rel: {
    name: 'Reliability',
    prefixes: ['rel-', 'rel.'],
    keywords: ['circuit', 'retry', 'outbox', 'timeout', 'failover'],
    description: 'Circuit breakers, retries, outbox',
  },
  obs: {
    name: 'Observability',
    prefixes: ['obs-', 'obs.'],
    keywords: ['log', 'metric', 'trace', 'monitor', 'alert'],
    description: 'Logging, metrics, tracing',
  },
  msg: {
    name: 'Messaging',
    prefixes: ['msg-', 'msg.'],
    keywords: ['queue', 'event', 'pubsub', 'kafka', 'rabbitmq'],
    description: 'Queues, events, pub/sub',
  },
  cache: {
    name: 'Caching',
    prefixes: ['cache-', 'cache.'],
    keywords: ['redis', 'memcache', 'cdn', 'invalidation'],
    description: 'Redis, CDN, invalidation',
  },
  test: {
    name: 'Testing',
    prefixes: ['test-', 'test.'],
    keywords: ['unit', 'integration', 'e2e', 'mock', 'fixture'],
    description: 'Unit, integration, e2e tests',
  },
} as const;

export type DomainKey = keyof typeof DOMAINS;

// =============================================================================
// QUERY PARSER
// =============================================================================

/**
 * Parse search query with operators
 * Supports:
 * - Phrases: "exact phrase"
 * - Required: +must +have
 * - Excluded: -not -this
 * - Fields: domain:api scope:security
 * - Fuzzy: word~
 */
export function parseQuery(queryString: string): ParsedQuery {
  const result: ParsedQuery = {
    terms: [],
    phrases: [],
    required: [],
    excluded: [],
    fields: {},
    fuzzy: false,
  };
  
  // Handle empty query
  if (!queryString.trim()) {
    return result;
  }
  
  // Extract phrases first
  const phraseRegex = /"([^"]+)"/g;
  let match;
  let remaining = queryString;
  
  while ((match = phraseRegex.exec(queryString)) !== null) {
    result.phrases.push(match[1]);
    remaining = remaining.replace(match[0], ' ');
  }
  
  // Process remaining tokens
  const tokens = remaining.split(/\s+/).filter(t => t.length > 0);
  
  for (const token of tokens) {
    // Field query (domain:api)
    if (token.includes(':')) {
      const [field, value] = token.split(':');
      result.fields[field.toLowerCase()] = value.toLowerCase();
      continue;
    }
    
    // Required term (+must)
    if (token.startsWith('+')) {
      result.required.push(token.slice(1).toLowerCase());
      continue;
    }
    
    // Excluded term (-not)
    if (token.startsWith('-')) {
      result.excluded.push(token.slice(1).toLowerCase());
      continue;
    }
    
    // Fuzzy term (word~)
    if (token.endsWith('~')) {
      result.terms.push(token.slice(0, -1).toLowerCase());
      result.fuzzy = true;
      continue;
    }
    
    // Regular term
    result.terms.push(token.toLowerCase());
  }
  
  return result;
}

// =============================================================================
// SEARCH ENGINE
// =============================================================================

/**
 * Advanced search engine with domain-aware ranking
 */
export class SearchEngine {
  private miniSearch: MiniSearch<SearchDocument>;
  private documents: Map<string, SearchDocument> = new Map();
  private initialized: boolean = false;
  
  // Configurable weights
  private fieldBoosts: Record<string, number> = {
    title: 3.0,
    tags: 2.0,
    description: 1.5,
    content: 1.0,
    sections: 0.8,
  };
  
  private domainBoosts: Record<DomainKey, number> = {
    api: 1.0,
    db: 1.0,
    sec: 1.2,  // Slightly higher for security
    rel: 1.1,
    obs: 1.0,
    msg: 1.0,
    cache: 1.0,
    test: 0.9,
  };
  
  constructor(options?: {
    fieldBoosts?: Record<string, number>;
    domainBoosts?: Partial<Record<DomainKey, number>>;
  }) {
    if (options?.fieldBoosts) {
      this.fieldBoosts = { ...this.fieldBoosts, ...options.fieldBoosts };
    }
    if (options?.domainBoosts) {
      this.domainBoosts = { ...this.domainBoosts, ...options.domainBoosts };
    }
    
    this.miniSearch = new MiniSearch({
      fields: ['title', 'description', 'content', 'tags', 'sections', 'checklistItems'],
      storeFields: ['id', 'title', 'type', 'domain', 'scope', 'level', 'maturity', 'path'],
      searchOptions: {
        boost: this.fieldBoosts,
        fuzzy: 0.2,
        prefix: true,
      },
      tokenize: this.tokenize.bind(this),
      processTerm: this.processTerm.bind(this),
    });
  }
  
  /**
   * Custom tokenizer
   */
  private tokenize(text: string): string[] {
    // Split on whitespace and punctuation, preserve compound words
    return text
      .toLowerCase()
      .split(/[\s\-_\.\/\\]+/)
      .filter(t => t.length > 1);
  }
  
  /**
   * Process search terms (stemming-like normalization)
   */
  private processTerm(term: string): string | null {
    // Remove common suffixes for basic stemming
    let processed = term.toLowerCase();
    
    // Skip very short terms
    if (processed.length < 2) return null;
    
    // Basic suffix removal
    const suffixes = ['ing', 'tion', 'ed', 'er', 'est', 'ly', 's'];
    for (const suffix of suffixes) {
      if (processed.length > suffix.length + 2 && processed.endsWith(suffix)) {
        processed = processed.slice(0, -suffix.length);
        break;
      }
    }
    
    return processed;
  }
  
  /**
   * Index documents
   */
  index(documents: SearchDocument[]): Result<number, BekError> {
    return tryCatch(
      () => {
        // Convert tags array to string for indexing - store as SearchableDocument
        const processedDocs = documents.map(doc => ({
          ...doc,
          tags: Array.isArray(doc.tags) ? doc.tags.join(' ') : doc.tags,
          stacks: Array.isArray(doc.stacks) ? doc.stacks.join(' ') : doc.stacks,
        }));
        
        // MiniSearch expects documents with string fields for indexing
        this.miniSearch.addAll(processedDocs as unknown as SearchDocument[]);
        
        // Store original documents
        for (const doc of documents) {
          this.documents.set(doc.id, doc);
        }
        
        this.initialized = true;
        return documents.length;
      },
      (error) => Errors.unknown(`Failed to index documents: ${error}`, error as Error)
    );
  }
  
  /**
   * Add single document
   */
  add(document: SearchDocument): void {
    const processed = {
      ...document,
      tags: Array.isArray(document.tags) ? document.tags.join(' ') : document.tags,
      stacks: Array.isArray(document.stacks) ? document.stacks.join(' ') : document.stacks,
    };
    
    // MiniSearch expects documents with string fields for indexing
    this.miniSearch.add(processed as unknown as SearchDocument);
    this.documents.set(document.id, document);
  }
  
  /**
   * Remove document by ID
   */
  remove(id: string): void {
    const doc = this.documents.get(id);
    if (doc) {
      this.miniSearch.remove(doc);
      this.documents.delete(id);
    }
  }
  
  /**
   * Search with query
   */
  search(query: SearchQuery): Result<SearchResponse, BekError> {
    const startTime = Date.now();
    
    if (!this.initialized && this.documents.size === 0) {
      return Err(Errors.unknown('Search engine not initialized'));
    }
    
    // Parse query
    const parsed = parseQuery(query.text);
    
    // Build search terms
    const searchTerms = [
      ...parsed.terms,
      ...parsed.phrases,
      ...parsed.required,
    ].join(' ');
    
    // Configure search options
    const searchOptions: any = {
      boost: { ...this.fieldBoosts, ...query.boost },
      fuzzy: query.exact ? false : (query.fuzzy ?? 0.2),
      prefix: !query.exact,
    };
    
    // Perform search
    let results: SearchResult[];
    if (searchTerms.length > 0) {
      results = this.miniSearch.search(searchTerms, searchOptions);
    } else {
      // No text query - return all documents for filtering
      results = Array.from(this.documents.values()).map((doc, idx) => ({
        id: doc.id,
        score: 1,
        terms: [],
        queryTerms: [],
        match: {},
      }));
    }
    
    // Apply filters and enhance results
    let filteredResults = this.applyFilters(results, query, parsed);
    
    // Calculate enhanced scores
    const enhancedResults = filteredResults.map(result => 
      this.enhanceResult(result, query, parsed)
    );
    
    // Sort results
    this.sortResults(enhancedResults, query);
    
    // Apply pagination
    const total = enhancedResults.length;
    const offset = query.offset || 0;
    const limit = query.limit || 20;
    const paginatedResults = enhancedResults.slice(offset, offset + limit);
    
    // Generate suggestions if few results
    const suggestions = total < 3 ? this.generateSuggestions(query, parsed) : undefined;
    
    // Calculate facets
    const facets = this.calculateFacets(enhancedResults);
    
    return Ok({
      results: paginatedResults,
      total,
      query,
      timing: Date.now() - startTime,
      suggestions,
      facets,
    });
  }
  
  /**
   * Apply filters to results
   */
  private applyFilters(
    results: SearchResult[],
    query: SearchQuery,
    parsed: ParsedQuery
  ): SearchResult[] {
    return results.filter(result => {
      const doc = this.documents.get(result.id);
      if (!doc) return false;
      
      // Field filters from query object
      if (query.domain) {
        const domains = Array.isArray(query.domain) ? query.domain : [query.domain];
        if (!domains.includes(doc.domain)) return false;
      }
      
      if (query.scope) {
        const scopes = Array.isArray(query.scope) ? query.scope : [query.scope];
        if (!scopes.includes(doc.scope)) return false;
      }
      
      if (query.level) {
        const levels = Array.isArray(query.level) ? query.level : [query.level];
        if (!levels.includes(doc.level)) return false;
      }
      
      if (query.maturity) {
        const maturities = Array.isArray(query.maturity) ? query.maturity : [query.maturity];
        if (!maturities.includes(doc.maturity)) return false;
      }
      
      if (query.type) {
        if (doc.type !== query.type) return false;
      }
      
      if (query.tags && query.tags.length > 0) {
        const hasTag = query.tags.some(tag => doc.tags.includes(tag));
        if (!hasTag) return false;
      }
      
      if (query.stacks && query.stacks.length > 0) {
        const hasStack = doc.worksWithAll || query.stacks.some(stack => doc.stacks.includes(stack));
        if (!hasStack) return false;
      }
      
      // Field filters from parsed query
      for (const [field, value] of Object.entries(parsed.fields)) {
        const docValue = (doc as any)[field];
        if (docValue && String(docValue).toLowerCase() !== value) {
          return false;
        }
      }
      
      // Excluded terms
      if (parsed.excluded.length > 0) {
        const docText = `${doc.title} ${doc.description || ''} ${doc.content}`.toLowerCase();
        for (const excluded of parsed.excluded) {
          if (docText.includes(excluded)) return false;
        }
      }
      
      // Required terms
      if (parsed.required.length > 0) {
        const docText = `${doc.title} ${doc.description || ''} ${doc.content}`.toLowerCase();
        for (const required of parsed.required) {
          if (!docText.includes(required)) return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * Enhance search result with detailed scoring
   */
  private enhanceResult(
    result: SearchResult,
    query: SearchQuery,
    parsed: ParsedQuery
  ): SearchResultItem {
    const doc = this.documents.get(result.id)!;
    
    // Calculate score breakdown
    const textMatch = result.score;
    const fieldBoost = 1.0; // Already applied by MiniSearch
    const domainBoost = this.domainBoosts[doc.domain as DomainKey] || 1.0;
    const popularityBoost = doc.popularity ? Math.log10(doc.popularity + 10) / 2 : 1.0;
    const recencyBoost = doc.lastUpdated 
      ? 1 + (1 / Math.log10((Date.now() - doc.lastUpdated) / 86400000 + 10))
      : 1.0;
    
    // Combined score
    const finalScore = textMatch * fieldBoost * domainBoost * popularityBoost * recencyBoost;
    
    // Generate highlights
    const highlights = this.generateHighlights(doc, parsed.terms);
    
    return {
      document: doc,
      score: finalScore,
      matchedTerms: result.terms || [],
      highlights,
      scoreBreakdown: {
        textMatch,
        fieldBoost,
        domainBoost,
        popularityBoost,
        recencyBoost,
      },
    };
  }
  
  /**
   * Generate text highlights for matched terms
   */
  private generateHighlights(
    doc: SearchDocument,
    terms: string[]
  ): Record<string, string[]> {
    const highlights: Record<string, string[]> = {};
    const fields = ['title', 'description', 'content'];
    
    for (const field of fields) {
      const text = (doc as any)[field];
      if (!text) continue;
      
      const fieldHighlights: string[] = [];
      
      for (const term of terms) {
        const regex = new RegExp(`(.{0,30})(${term})(.{0,30})`, 'gi');
        let match;
        
        while ((match = regex.exec(text)) !== null) {
          const highlight = `...${match[1]}**${match[2]}**${match[3]}...`;
          fieldHighlights.push(highlight);
          
          if (fieldHighlights.length >= 3) break;
        }
      }
      
      if (fieldHighlights.length > 0) {
        highlights[field] = fieldHighlights;
      }
    }
    
    return highlights;
  }
  
  /**
   * Sort results based on query options
   */
  private sortResults(results: SearchResultItem[], query: SearchQuery): void {
    const sortBy = query.sortBy || 'relevance';
    const sortOrder = query.sortOrder || 'desc';
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    
    results.sort((a, b) => {
      switch (sortBy) {
        case 'relevance':
          return (b.score - a.score) * multiplier;
        
        case 'popularity':
          return ((b.document.popularity || 0) - (a.document.popularity || 0)) * multiplier;
        
        case 'recent':
          return ((b.document.lastUpdated || 0) - (a.document.lastUpdated || 0)) * multiplier;
        
        case 'alphabetical':
          return a.document.title.localeCompare(b.document.title) * multiplier;
        
        default:
          return b.score - a.score;
      }
    });
  }
  
  /**
   * Generate search suggestions
   */
  private generateSuggestions(query: SearchQuery, parsed: ParsedQuery): string[] {
    const suggestions: string[] = [];
    
    // Suggest removing filters
    if (query.domain) {
      suggestions.push(`Try removing domain filter: ${query.domain}`);
    }
    if (query.level) {
      suggestions.push(`Try removing level filter: ${query.level}`);
    }
    
    // Suggest alternative terms
    if (parsed.terms.length > 0) {
      const autoSuggestions = this.miniSearch.autoSuggest(parsed.terms[0]).slice(0, 3);
      for (const suggestion of autoSuggestions) {
        suggestions.push(`Did you mean: ${suggestion.suggestion}?`);
      }
    }
    
    return suggestions.slice(0, 5);
  }
  
  /**
   * Calculate facets for filtering
   */
  private calculateFacets(results: SearchResultItem[]): SearchResponse['facets'] {
    const facets: SearchResponse['facets'] = {
      domain: {},
      scope: {},
      level: {},
      tags: {},
    };
    
    for (const result of results) {
      const doc = result.document;
      
      facets.domain[doc.domain] = (facets.domain[doc.domain] || 0) + 1;
      facets.scope[doc.scope] = (facets.scope[doc.scope] || 0) + 1;
      facets.level[doc.level] = (facets.level[doc.level] || 0) + 1;
      
      for (const tag of doc.tags) {
        facets.tags[tag] = (facets.tags[tag] || 0) + 1;
      }
    }
    
    return facets;
  }
  
  /**
   * Get document by ID
   */
  getDocument(id: string): SearchDocument | undefined {
    return this.documents.get(id);
  }
  
  /**
   * Get all documents
   */
  getAllDocuments(): SearchDocument[] {
    return Array.from(this.documents.values());
  }
  
  /**
   * Get document count
   */
  getDocumentCount(): number {
    return this.documents.size;
  }
  
  /**
   * Clear all indexed documents
   */
  clear(): void {
    this.miniSearch.removeAll();
    this.documents.clear();
    this.initialized = false;
  }
  
  /**
   * Export index for caching
   */
  exportIndex(): string {
    return JSON.stringify({
      index: this.miniSearch.toJSON(),
      documents: Array.from(this.documents.values()),
    });
  }
  
  /**
   * Import index from cache
   */
  importIndex(data: string): Result<number, BekError> {
    return tryCatch(
      () => {
        const parsed = JSON.parse(data);
        
        // Recreate MiniSearch with same options
        this.miniSearch = MiniSearch.loadJSON(JSON.stringify(parsed.index), {
          fields: ['title', 'description', 'content', 'tags', 'sections', 'checklistItems'],
          storeFields: ['id', 'title', 'type', 'domain', 'scope', 'level', 'maturity', 'path'],
        });
        
        // Restore documents
        for (const doc of parsed.documents) {
          this.documents.set(doc.id, doc);
        }
        
        this.initialized = true;
        return this.documents.size;
      },
      (error) => Errors.unknown(`Failed to import index: ${error}`, error as Error)
    );
  }
}

// =============================================================================
// SINGLETON & FACTORY
// =============================================================================

let globalSearchEngine: SearchEngine | null = null;

/**
 * Get global search engine instance
 */
export function getSearchEngine(): SearchEngine {
  if (!globalSearchEngine) {
    globalSearchEngine = new SearchEngine();
  }
  return globalSearchEngine;
}

/**
 * Reset search engine (for testing)
 */
export function resetSearchEngine(): void {
  globalSearchEngine = null;
}

/**
 * Quick search helper
 */
export async function quickSearch(
  text: string,
  options: Omit<SearchQuery, 'text'> = {}
): Promise<Result<SearchResultItem[], BekError>> {
  const engine = getSearchEngine();
  const result = engine.search({ text, ...options });
  
  if (!isOk(result)) {
    return result as Result<SearchResultItem[], BekError>;
  }
  
  return Ok(result.value.results);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Detect domain from pattern ID
 */
export function detectDomain(id: string): DomainKey | null {
  const lowerId = id.toLowerCase();
  
  for (const [key, config] of Object.entries(DOMAINS)) {
    for (const prefix of config.prefixes) {
      if (lowerId.startsWith(prefix)) {
        return key as DomainKey;
      }
    }
  }
  
  return null;
}

/**
 * Get domain info
 */
export function getDomainInfo(domain: DomainKey) {
  return DOMAINS[domain];
}

/**
 * List all domains
 */
export function listDomains(): Array<{ key: DomainKey; name: string; description: string }> {
  return Object.entries(DOMAINS).map(([key, config]) => ({
    key: key as DomainKey,
    name: config.name,
    description: config.description,
  }));
}
