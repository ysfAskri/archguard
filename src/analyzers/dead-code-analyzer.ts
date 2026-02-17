import type { AnalysisContext, Finding } from '../core/types.js';
import { Severity } from '../core/types.js';
import { BaseAnalyzer } from './base-analyzer.js';
import { buildDependencyGraph } from '../core/dependency-graph.js';
import { collectExports } from '../parsers/language-imports.js';
import { minimatch } from 'minimatch';

export class DeadCodeAnalyzer extends BaseAnalyzer {
  name = 'dead-code';

  protected defaultSeverity(): Severity {
    return Severity.Warning;
  }

  async analyze(context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const deadCodeConfig = context.config.analyzers.deadCode;
    if (!deadCodeConfig?.enabled) return findings;

    const severity = deadCodeConfig.severity;
    const entryPoints = deadCodeConfig.entryPoints ?? [];

    // Build dependency graph from all parsed files
    const graph = buildDependencyGraph(context.parsedFiles, context.projectRoot);

    // Collect all imports across all files (what symbols are actually used)
    const allImportedSymbols = new Map<string, Set<string>>(); // file path → set of imported symbols

    for (const [filePath, node] of graph.nodes) {
      for (const importedFile of node.imports) {
        if (!allImportedSymbols.has(importedFile)) {
          allImportedSymbols.set(importedFile, new Set());
        }
      }
    }

    // For each file, check if its exports are imported anywhere
    for (const file of context.parsedFiles) {
      // Skip entry points
      if (this.isEntryPoint(file.path, entryPoints)) continue;

      // Skip test files
      if (this.isTestFile(file.path)) continue;

      const exports = collectExports(file.tree, file.language);
      if (exports.length === 0) continue;

      const graphNode = graph.nodes.get(file.path);
      if (!graphNode) continue;

      // If no other file imports this file at all, all exports are unused
      if (graphNode.importedBy.length === 0 && exports.length > 0) {
        for (const exportName of exports) {
          findings.push(this.createFinding(
            'dead-code/unused-export',
            file.path,
            1,
            `Export '${exportName}' is never imported by any other file`,
            { severity },
          ));
        }
      }
    }

    return findings;
  }

  private isEntryPoint(filePath: string, entryPoints: string[]): boolean {
    if (entryPoints.length === 0) {
      // Default entry points
      return filePath.includes('index.') || filePath.includes('main.');
    }
    return entryPoints.some(ep => minimatch(filePath, ep) || filePath === ep);
  }

  private isTestFile(filePath: string): boolean {
    return /\.(test|spec|e2e)\.[jt]sx?$/.test(filePath) ||
           filePath.includes('__tests__/') ||
           filePath.includes('tests/');
  }
}
