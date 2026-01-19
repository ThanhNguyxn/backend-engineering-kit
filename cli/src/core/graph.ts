/**
 * Pattern Dependency Graph - Inspired by Turborepo/Nx
 * DAG-based pattern dependency resolution with topological sort
 * 
 * @module core/graph
 */
import { Result, Ok, Err, Errors, BekError, isOk } from './result.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Pattern node in the dependency graph
 */
export interface PatternNode {
  id: string;
  name: string;
  version?: string;
  dependencies: string[];      // Hard dependencies (required)
  optionalDeps: string[];      // Soft dependencies (recommended)
  peerDeps: string[];          // Peer dependencies (must be co-installed)
  tags: string[];
  scope: string;
  installed?: boolean;
}

/**
 * Edge types in the graph
 */
export type EdgeType = 'dependency' | 'optional' | 'peer';

/**
 * Edge between two nodes
 */
export interface GraphEdge {
  from: string;
  to: string;
  type: EdgeType;
}

/**
 * Resolution result for a pattern installation
 */
export interface ResolutionResult {
  /** Patterns in topological order (install in this order) */
  installOrder: string[];
  /** Already installed patterns (can skip) */
  alreadyInstalled: string[];
  /** Missing dependencies that couldn't be resolved */
  missing: string[];
  /** Optional patterns that could be installed */
  optional: string[];
  /** Patterns that would be upgraded */
  upgrades: Array<{ id: string; from: string; to: string }>;
}

/**
 * Graph traversal state
 */
type VisitState = 'unvisited' | 'visiting' | 'visited';

// =============================================================================
// DEPENDENCY GRAPH
// =============================================================================

/**
 * DAG-based dependency graph for patterns
 * Supports topological sorting, cycle detection, and transit nodes
 */
export class DependencyGraph {
  private nodes: Map<string, PatternNode> = new Map();
  private edges: GraphEdge[] = [];
  private adjacencyList: Map<string, Set<string>> = new Map();
  private reverseAdjacency: Map<string, Set<string>> = new Map();
  
  constructor() {}
  
  /**
   * Add a pattern node to the graph
   */
  addNode(node: PatternNode): void {
    this.nodes.set(node.id, node);
    
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, new Set());
    }
    if (!this.reverseAdjacency.has(node.id)) {
      this.reverseAdjacency.set(node.id, new Set());
    }
  }
  
  /**
   * Add multiple nodes at once
   */
  addNodes(nodes: PatternNode[]): void {
    for (const node of nodes) {
      this.addNode(node);
    }
  }
  
  /**
   * Get a node by ID
   */
  getNode(id: string): PatternNode | undefined {
    return this.nodes.get(id);
  }
  
  /**
   * Get all node IDs
   */
  getAllNodeIds(): string[] {
    return Array.from(this.nodes.keys());
  }
  
  /**
   * Add an edge between two nodes
   */
  addEdge(from: string, to: string, type: EdgeType = 'dependency'): Result<void, BekError> {
    // Validate nodes exist
    if (!this.nodes.has(from)) {
      return Err(Errors.patternNotFound(from, this.getAllNodeIds()));
    }
    if (!this.nodes.has(to)) {
      return Err(Errors.patternNotFound(to, this.getAllNodeIds()));
    }
    
    // Add edge
    this.edges.push({ from, to, type });
    this.adjacencyList.get(from)!.add(to);
    this.reverseAdjacency.get(to)!.add(from);
    
    return Ok(undefined);
  }
  
  /**
   * Build edges from node dependencies
   */
  buildEdges(): Result<void, BekError> {
    for (const [id, node] of this.nodes) {
      // Hard dependencies
      for (const dep of node.dependencies) {
        if (this.nodes.has(dep)) {
          this.addEdge(id, dep, 'dependency');
        }
      }
      
      // Optional dependencies
      for (const dep of node.optionalDeps) {
        if (this.nodes.has(dep)) {
          this.addEdge(id, dep, 'optional');
        }
      }
      
      // Peer dependencies
      for (const dep of node.peerDeps) {
        if (this.nodes.has(dep)) {
          this.addEdge(id, dep, 'peer');
        }
      }
    }
    
    return Ok(undefined);
  }
  
  /**
   * Detect cycles in the graph
   */
  detectCycles(): Result<string[][] | null, BekError> {
    const visited = new Map<string, VisitState>();
    const cycles: string[][] = [];
    const path: string[] = [];
    
    const dfs = (nodeId: string): boolean => {
      visited.set(nodeId, 'visiting');
      path.push(nodeId);
      
      const neighbors = this.adjacencyList.get(nodeId) || new Set();
      for (const neighbor of neighbors) {
        const state = visited.get(neighbor);
        
        if (state === 'visiting') {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          const cycle = [...path.slice(cycleStart), neighbor];
          cycles.push(cycle);
          return true;
        }
        
        if (state !== 'visited') {
          dfs(neighbor);
        }
      }
      
      visited.set(nodeId, 'visited');
      path.pop();
      return false;
    };
    
    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }
    
    return Ok(cycles.length > 0 ? cycles : null);
  }
  
  /**
   * Topological sort using Kahn's algorithm
   * Returns nodes in dependency order (dependencies first)
   */
  topologicalSort(): Result<string[], BekError> {
    // Check for cycles first
    const cycleResult = this.detectCycles();
    if (isOk(cycleResult) && cycleResult.value) {
      return Err(Errors.patternDependencyCycle(cycleResult.value[0]));
    }
    
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];
    
    // Initialize in-degrees
    for (const nodeId of this.nodes.keys()) {
      inDegree.set(nodeId, 0);
    }
    
    // Calculate in-degrees
    for (const [nodeId, neighbors] of this.adjacencyList) {
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) + 1);
      }
    }
    
    // Add nodes with 0 in-degree to queue
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }
    
    // Process queue
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);
      
      const neighbors = this.adjacencyList.get(nodeId) || new Set();
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDegree);
        
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }
    
    // Reverse to get install order (dependencies first)
    return Ok(result.reverse());
  }
  
  /**
   * Get all dependencies (transitive) for a pattern
   */
  getTransitiveDependencies(id: string, includeOptional: boolean = false): Result<Set<string>, BekError> {
    if (!this.nodes.has(id)) {
      return Err(Errors.patternNotFound(id, this.getAllNodeIds()));
    }
    
    const result = new Set<string>();
    const visited = new Set<string>();
    const stack = [id];
    
    while (stack.length > 0) {
      const current = stack.pop()!;
      
      if (visited.has(current)) continue;
      visited.add(current);
      
      const node = this.nodes.get(current);
      if (!node) continue;
      
      // Add hard dependencies
      for (const dep of node.dependencies) {
        if (!result.has(dep) && this.nodes.has(dep)) {
          result.add(dep);
          stack.push(dep);
        }
      }
      
      // Optionally add soft dependencies
      if (includeOptional) {
        for (const dep of node.optionalDeps) {
          if (!result.has(dep) && this.nodes.has(dep)) {
            result.add(dep);
            stack.push(dep);
          }
        }
      }
    }
    
    return Ok(result);
  }
  
  /**
   * Get dependents (patterns that depend on this one)
   */
  getDependents(id: string): Result<Set<string>, BekError> {
    if (!this.nodes.has(id)) {
      return Err(Errors.patternNotFound(id, this.getAllNodeIds()));
    }
    
    return Ok(this.reverseAdjacency.get(id) || new Set());
  }
  
  /**
   * Find patterns affected by changes to given patterns
   */
  getAffected(changedIds: string[]): Result<Set<string>, BekError> {
    const affected = new Set<string>();
    const stack = [...changedIds];
    
    while (stack.length > 0) {
      const current = stack.pop()!;
      
      if (affected.has(current)) continue;
      affected.add(current);
      
      const dependents = this.reverseAdjacency.get(current);
      if (dependents) {
        for (const dep of dependents) {
          if (!affected.has(dep)) {
            stack.push(dep);
          }
        }
      }
    }
    
    return Ok(affected);
  }
  
  /**
   * Resolve installation order for given patterns
   */
  resolve(
    patternIds: string[],
    options: {
      includeOptional?: boolean;
      installedPatterns?: Set<string>;
    } = {}
  ): Result<ResolutionResult, BekError> {
    const { includeOptional = false, installedPatterns = new Set() } = options;
    
    const toInstall = new Set<string>();
    const missing: string[] = [];
    const optional: string[] = [];
    
    // Collect all required patterns and their dependencies
    for (const id of patternIds) {
      if (!this.nodes.has(id)) {
        missing.push(id);
        continue;
      }
      
      toInstall.add(id);
      
      // Get transitive dependencies
      const depsResult = this.getTransitiveDependencies(id, false);
      if (isOk(depsResult)) {
        for (const dep of depsResult.value) {
          toInstall.add(dep);
        }
      }
      
      // Collect optional dependencies
      if (includeOptional) {
        const node = this.nodes.get(id);
        if (node) {
          for (const dep of node.optionalDeps) {
            if (this.nodes.has(dep) && !installedPatterns.has(dep)) {
              optional.push(dep);
            }
          }
        }
      }
    }
    
    // Filter out already installed
    const alreadyInstalled: string[] = [];
    for (const id of Array.from(toInstall)) {
      if (installedPatterns.has(id)) {
        alreadyInstalled.push(id);
        toInstall.delete(id);
      }
    }
    
    // Build subgraph for topological sort
    const subgraph = new DependencyGraph();
    for (const id of toInstall) {
      const node = this.nodes.get(id);
      if (node) {
        subgraph.addNode(node);
      }
    }
    subgraph.buildEdges();
    
    // Get install order
    const sortResult = subgraph.topologicalSort();
    if (!isOk(sortResult)) {
      return sortResult as Result<ResolutionResult, BekError>;
    }
    
    return Ok({
      installOrder: sortResult.value,
      alreadyInstalled,
      missing,
      optional: [...new Set(optional)],
      upgrades: [], // TODO: implement version comparison
    });
  }
  
  /**
   * Check if pattern can be safely removed
   */
  canRemove(id: string, installedPatterns: Set<string>): Result<{ canRemove: boolean; blockedBy: string[] }, BekError> {
    if (!this.nodes.has(id)) {
      return Err(Errors.patternNotFound(id, this.getAllNodeIds()));
    }
    
    const dependents = this.reverseAdjacency.get(id) || new Set();
    const blockedBy: string[] = [];
    
    for (const dependent of dependents) {
      if (installedPatterns.has(dependent)) {
        blockedBy.push(dependent);
      }
    }
    
    return Ok({
      canRemove: blockedBy.length === 0,
      blockedBy,
    });
  }
  
  /**
   * Get statistics about the graph
   */
  getStats(): {
    totalNodes: number;
    totalEdges: number;
    rootNodes: number;
    leafNodes: number;
    maxDepth: number;
  } {
    let rootNodes = 0;
    let leafNodes = 0;
    let maxDepth = 0;
    
    for (const [id, node] of this.nodes) {
      const inDegree = this.reverseAdjacency.get(id)?.size || 0;
      const outDegree = this.adjacencyList.get(id)?.size || 0;
      
      if (inDegree === 0) rootNodes++;
      if (outDegree === 0) leafNodes++;
    }
    
    // Calculate max depth via BFS
    const visited = new Set<string>();
    const depths = new Map<string, number>();
    
    // Start from root nodes
    const queue: Array<{ id: string; depth: number }> = [];
    for (const [id] of this.nodes) {
      const inDegree = this.reverseAdjacency.get(id)?.size || 0;
      if (inDegree === 0) {
        queue.push({ id, depth: 0 });
        depths.set(id, 0);
      }
    }
    
    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      
      if (visited.has(id)) continue;
      visited.add(id);
      
      maxDepth = Math.max(maxDepth, depth);
      
      const neighbors = this.adjacencyList.get(id) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          const newDepth = depth + 1;
          if (!depths.has(neighbor) || depths.get(neighbor)! < newDepth) {
            depths.set(neighbor, newDepth);
            queue.push({ id: neighbor, depth: newDepth });
          }
        }
      }
    }
    
    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.length,
      rootNodes,
      leafNodes,
      maxDepth,
    };
  }
  
  /**
   * Serialize graph to JSON
   */
  toJSON(): object {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
    };
  }
  
  /**
   * Load graph from JSON
   */
  static fromJSON(data: { nodes: PatternNode[]; edges?: GraphEdge[] }): DependencyGraph {
    const graph = new DependencyGraph();
    
    for (const node of data.nodes) {
      graph.addNode(node);
    }
    
    if (data.edges) {
      for (const edge of data.edges) {
        graph.addEdge(edge.from, edge.to, edge.type);
      }
    } else {
      graph.buildEdges();
    }
    
    return graph;
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a graph from registry patterns
 */
export function createGraphFromRegistry(patterns: Array<{
  id: string;
  name: string;
  version?: string;
  depends_on?: string[];
  recommends?: string[];
  conflicts_with?: string[];
  tags?: string[];
  scope?: string;
}>): DependencyGraph {
  const graph = new DependencyGraph();
  
  for (const pattern of patterns) {
    graph.addNode({
      id: pattern.id,
      name: pattern.name,
      version: pattern.version,
      dependencies: pattern.depends_on || [],
      optionalDeps: pattern.recommends || [],
      peerDeps: [],
      tags: pattern.tags || [],
      scope: pattern.scope || 'general',
    });
  }
  
  graph.buildEdges();
  return graph;
}

/**
 * Quickly resolve dependencies for pattern IDs
 */
export function quickResolve(
  patterns: PatternNode[],
  targetIds: string[],
  installed: string[] = []
): Result<string[], BekError> {
  const graph = new DependencyGraph();
  graph.addNodes(patterns);
  graph.buildEdges();
  
  const result = graph.resolve(targetIds, {
    installedPatterns: new Set(installed),
  });
  
  if (!isOk(result)) {
    return result as Result<string[], BekError>;
  }
  
  return Ok(result.value.installOrder);
}
