import type { AnalysisContext, Finding } from '../core/types.js';
import { Severity } from '../core/types.js';
import { BaseAnalyzer } from './base-analyzer.js';
import { buildDependencyGraph, getConsumers } from '../core/dependency-graph.js';

export class ImpactAnalyzer extends BaseAnalyzer {
  name = 'impact';

  protected defaultSeverity(): Severity {
    return Severity.Info;
  }

  async analyze(context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const impactConfig = context.config.analyzers.impact;
    if (!impactConfig?.enabled) return findings;

    const depth = impactConfig.depth ?? 2;
    const graph = buildDependencyGraph(context.parsedFiles, context.projectRoot);

    // For each changed file, report downstream consumers
    for (const file of context.files) {
      if (file.status === 'deleted') continue;

      const consumers = getConsumers(graph, file.path, depth);
      if (consumers.length > 0) {
        findings.push(this.createFinding(
          'impact/downstream-consumers',
          file.path,
          1,
          `Changes to this file impact ${consumers.length} downstream file${consumers.length > 1 ? 's' : ''}: ${consumers.slice(0, 5).join(', ')}${consumers.length > 5 ? ` (+${consumers.length - 5} more)` : ''}`,
          { severity: impactConfig.severity ?? Severity.Info },
        ));
      }
    }

    return findings;
  }
}
