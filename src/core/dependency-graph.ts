import path from 'node:path';
import type { ParsedFile } from './types.js';
import { collectLanguageImports, collectExports } from '../parsers/language-imports.js';

export interface DependencyNode {
  imports: string[];
  importedBy: string[];
  exports: string[];
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
}

/**
 * Normalize a relative path using posix-like resolution.
 * Works correctly on both Unix and Windows by avoiding native path.resolve with '/'.
 */
function posixJoin(dir: string, relative: string): string {
  // Normalize to forward slashes
  const parts = dir.replace(/\\/g, '/').split('/');
  const relParts = relative.replace(/\\/g, '/').split('/');

  for (const part of relParts) {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.') {
      parts.push(part);
    }
  }

  return parts.filter(Boolean).join('/');
}

function resolveImportPath(importSource: string, fromFile: string, allPaths: Set<string>): string | null {
  if (!importSource || importSource.startsWith('@') || !importSource.startsWith('.')) {
    return null; // external package
  }

  const dir = path.posix.dirname(fromFile.replace(/\\/g, '/'));
  const rawResolved = posixJoin(dir, importSource);

  // Strip .js extension to try .ts variants (ESM projects use .js in imports for .ts files)
  const withoutExt = rawResolved.replace(/\.(js|jsx)$/, '');

  // Try exact match first, then with common extensions
  const candidates = [
    rawResolved,
    withoutExt + '.ts',
    withoutExt + '.tsx',
    withoutExt + '.js',
    withoutExt + '.jsx',
    withoutExt + '.py',
    withoutExt + '.go',
    withoutExt + '.rs',
    withoutExt + '.java',
    withoutExt + '/index.ts',
    withoutExt + '/index.js',
  ];

  for (const candidate of candidates) {
    if (allPaths.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function buildDependencyGraph(parsedFiles: ParsedFile[], projectRoot: string): DependencyGraph {
  const graph: DependencyGraph = { nodes: new Map() };
  const allPaths = new Set(parsedFiles.map(f => f.path));

  // Initialize nodes
  for (const file of parsedFiles) {
    graph.nodes.set(file.path, { imports: [], importedBy: [], exports: [] });
  }

  // Collect imports and build edges
  for (const file of parsedFiles) {
    const imports = collectLanguageImports(file.tree, file.language);
    const exports = collectExports(file.tree, file.language);
    const node = graph.nodes.get(file.path)!;
    node.exports = exports;

    for (const imp of imports) {
      const resolved = resolveImportPath(imp.source, file.path, allPaths);
      if (resolved && resolved !== file.path) {
        node.imports.push(resolved);
        const targetNode = graph.nodes.get(resolved);
        if (targetNode) {
          targetNode.importedBy.push(file.path);
        }
      }
    }
  }

  return graph;
}

export function getConsumers(graph: DependencyGraph, filePath: string, depth: number = 1): string[] {
  const visited = new Set<string>();
  const queue: Array<{ path: string; currentDepth: number }> = [{ path: filePath, currentDepth: 0 }];

  while (queue.length > 0) {
    const { path, currentDepth } = queue.shift()!;
    if (visited.has(path)) continue;
    visited.add(path);

    if (currentDepth >= depth) continue;

    const node = graph.nodes.get(path);
    if (!node) continue;

    for (const consumer of node.importedBy) {
      if (!visited.has(consumer)) {
        queue.push({ path: consumer, currentDepth: currentDepth + 1 });
      }
    }
  }

  visited.delete(filePath);
  return [...visited];
}

export function getImpactedFiles(graph: DependencyGraph, changedFiles: string[], depth: number = 2): Map<string, string[]> {
  const impact = new Map<string, string[]>();

  for (const file of changedFiles) {
    const consumers = getConsumers(graph, file, depth);
    if (consumers.length > 0) {
      impact.set(file, consumers);
    }
  }

  return impact;
}
