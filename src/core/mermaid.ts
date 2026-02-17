import type { DependencyGraph } from './dependency-graph.js';
import { getConsumers } from './dependency-graph.js';
import { basename, dirname } from 'node:path';

function sanitizeId(path: string): string {
  return path.replace(/[^a-zA-Z0-9]/g, '_');
}

function shortName(path: string): string {
  return basename(path);
}

export function generateImpactDiagram(
  changedFiles: string[],
  graph: DependencyGraph,
  depth: number = 2,
): string {
  const lines: string[] = ['graph LR'];
  const edges = new Set<string>();
  const changedSet = new Set(changedFiles);

  for (const file of changedFiles) {
    const id = sanitizeId(file);
    lines.push(`  ${id}["${shortName(file)}"]:::changed`);

    const consumers = getConsumers(graph, file, depth);
    for (const consumer of consumers) {
      const consumerId = sanitizeId(consumer);
      if (!changedSet.has(consumer)) {
        lines.push(`  ${consumerId}["${shortName(consumer)}"]`);
      }
      const edge = `${id} --> ${consumerId}`;
      if (!edges.has(edge)) {
        edges.add(edge);
        lines.push(`  ${edge}`);
      }
    }
  }

  lines.push('  classDef changed fill:#f96,stroke:#333,stroke-width:2px');

  return lines.join('\n');
}

export function generateArchitectureDiagram(
  graph: DependencyGraph,
  scope?: string,
): string {
  const lines: string[] = ['graph TD'];
  const edges = new Set<string>();

  // Group files by directory
  const dirGroups = new Map<string, string[]>();
  for (const [path] of graph.nodes) {
    if (scope && !path.includes(scope)) continue;
    const dir = dirname(path);
    const group = dirGroups.get(dir) ?? [];
    group.push(path);
    dirGroups.set(dir, group);
  }

  // Create subgraphs per directory
  for (const [dir, files] of dirGroups) {
    const dirId = sanitizeId(dir);
    lines.push(`  subgraph ${dirId}["${dir}"]`);
    for (const file of files) {
      lines.push(`    ${sanitizeId(file)}["${shortName(file)}"]`);
    }
    lines.push('  end');
  }

  // Add edges
  for (const [path, node] of graph.nodes) {
    if (scope && !path.includes(scope)) continue;
    const fromId = sanitizeId(path);
    for (const imp of node.imports) {
      if (scope && !imp.includes(scope)) continue;
      const toId = sanitizeId(imp);
      const edge = `${fromId} --> ${toId}`;
      if (!edges.has(edge)) {
        edges.add(edge);
        lines.push(`  ${edge}`);
      }
    }
  }

  return lines.join('\n');
}
