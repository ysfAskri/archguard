import type { AnalysisContext, Finding } from '../core/types.js';
import { Severity } from '../core/types.js';
import { BaseAnalyzer } from './base-analyzer.js';
import { logger } from '../utils/logger.js';
import { collectDependencies, type PackageDependency } from '../core/dependency-collector.js';

interface OsvVulnerability {
  id: string;
  summary: string;
  details?: string;
  severity?: Array<{ type: string; score: string }>;
  affected?: Array<{
    package?: { name: string; ecosystem: string };
    ranges?: Array<{ events: Array<{ introduced?: string; fixed?: string }> }>;
  }>;
}

interface OsvResponse {
  vulns?: OsvVulnerability[];
}

const REQUEST_TIMEOUT_MS = 15_000;

export class DependencyScanner extends BaseAnalyzer {
  name = 'dependencies';

  protected defaultSeverity(): Severity {
    return Severity.Error;
  }

  async analyze(context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const depConfig = context.config.analyzers.dependencies;
    if (!depConfig?.enabled) return findings;

    const deps = await collectDependencies(context.projectRoot);
    if (deps.length === 0) return findings;

    logger.debug(`Checking ${deps.length} dependencies for known vulnerabilities`);

    // Query OSV API in batches
    for (const dep of deps) {
      try {
        const vulns = await this.queryOsv(dep);
        for (const vuln of vulns) {
          findings.push(this.createFinding(
            'dependency/known-vulnerability',
            dep.ecosystem === 'npm' ? 'package.json' :
              dep.ecosystem === 'Go' ? 'go.mod' :
              dep.ecosystem === 'crates.io' ? 'Cargo.toml' :
              dep.ecosystem === 'Maven' ? 'pom.xml' : 'package.json',
            1,
            `${dep.name}@${dep.version}: ${vuln.summary} (${vuln.id})`,
            { severity: depConfig.severity ?? Severity.Error },
          ));
        }
      } catch (err) {
        logger.warn(`OSV query failed for ${dep.name}: ${(err as Error).message}`);
      }
    }

    return findings;
  }

  private async queryOsv(dep: PackageDependency): Promise<OsvVulnerability[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch('https://api.osv.dev/v1/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package: { name: dep.name, ecosystem: dep.ecosystem },
          version: dep.version,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as OsvResponse;
      return data.vulns ?? [];
    } catch {
      clearTimeout(timer);
      return [];
    }
  }
}
