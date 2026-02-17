import type { AnalysisContext, Finding } from '../core/types.js';
import { Severity } from '../core/types.js';
import { BaseAnalyzer } from './base-analyzer.js';
import { collectDependencies, type PackageDependency } from '../core/dependency-collector.js';
import { minimatch } from 'minimatch';
import { logger } from '../utils/logger.js';

const REQUEST_TIMEOUT_MS = 10_000;

export class LicenseScanner extends BaseAnalyzer {
  name = 'licenses';

  protected defaultSeverity(): Severity {
    return Severity.Warning;
  }

  async analyze(context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const licenseConfig = context.config.analyzers.licenses;
    if (!licenseConfig?.enabled) return findings;

    const severity = licenseConfig.severity;
    const allowed = licenseConfig.allowed;
    const denied = licenseConfig.denied;

    const deps = await collectDependencies(context.projectRoot);
    if (deps.length === 0) return findings;

    // Only check production dependencies for npm (filter out devDependencies by checking against package.json)
    for (const dep of deps) {
      try {
        const license = await this.fetchLicense(dep);
        if (!license) continue;

        if (denied.length > 0 && this.matchesList(license, denied)) {
          findings.push(this.createFinding(
            'license/incompatible-license',
            dep.ecosystem === 'npm' ? 'package.json' :
              dep.ecosystem === 'Go' ? 'go.mod' :
              dep.ecosystem === 'crates.io' ? 'Cargo.toml' :
              dep.ecosystem === 'Maven' ? 'pom.xml' : 'package.json',
            1,
            `${dep.name}@${dep.version} uses denied license: ${license}`,
            { severity: Severity.Error },
          ));
        } else if (allowed.length > 0 && !this.matchesList(license, allowed)) {
          findings.push(this.createFinding(
            'license/incompatible-license',
            dep.ecosystem === 'npm' ? 'package.json' :
              dep.ecosystem === 'Go' ? 'go.mod' :
              dep.ecosystem === 'crates.io' ? 'Cargo.toml' :
              dep.ecosystem === 'Maven' ? 'pom.xml' : 'package.json',
            1,
            `${dep.name}@${dep.version} uses license '${license}' not in allowed list`,
            { severity },
          ));
        }
      } catch (err) {
        logger.debug(`Failed to fetch license for ${dep.name}: ${(err as Error).message}`);
      }
    }

    return findings;
  }

  private async fetchLicense(dep: PackageDependency): Promise<string | null> {
    switch (dep.ecosystem) {
      case 'npm': return this.fetchNpmLicense(dep.name, dep.version);
      case 'crates.io': return this.fetchCratesLicense(dep.name);
      default: return null;
    }
  }

  private async fetchNpmLicense(name: string, version: string): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(
        `https://registry.npmjs.org/${name}/${version}`,
        { signal: controller.signal },
      );
      clearTimeout(timer);

      if (!response.ok) return null;
      const data = await response.json() as { license?: string };
      return data.license ?? null;
    } catch {
      clearTimeout(timer);
      return null;
    }
  }

  private async fetchCratesLicense(name: string): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(
        `https://crates.io/api/v1/crates/${name}`,
        {
          signal: controller.signal,
          headers: { 'User-Agent': 'archguardian/1.1.0' },
        },
      );
      clearTimeout(timer);

      if (!response.ok) return null;
      const data = await response.json() as { crate?: { license?: string } };
      return data.crate?.license ?? null;
    } catch {
      clearTimeout(timer);
      return null;
    }
  }

  private matchesList(license: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      if (pattern.includes('*')) {
        return minimatch(license, pattern);
      }
      return license === pattern;
    });
  }
}
