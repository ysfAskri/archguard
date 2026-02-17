import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, posix } from 'node:path';
import { minimatch } from 'minimatch';
import type { AnalysisContext, Finding } from '../core/types.js';
import { Severity } from '../core/types.js';
import { BaseAnalyzer } from './base-analyzer.js';

export class IacAnalyzer extends BaseAnalyzer {
  name = 'iac';

  protected defaultSeverity(): Severity {
    return Severity.Warning;
  }

  async analyze(context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const iacConfig = context.config.analyzers.iac;
    if (!iacConfig?.enabled) return findings;

    const severity = iacConfig.severity;

    if (iacConfig.dockerfile !== false) {
      findings.push(...await this.analyzeDockerfiles(context.projectRoot, severity));
    }
    if (iacConfig.kubernetes !== false) {
      findings.push(...await this.analyzeKubernetes(context.projectRoot, severity));
    }
    if (iacConfig.actions !== false) {
      findings.push(...await this.analyzeGitHubActions(context.projectRoot, severity));
    }

    return findings;
  }

  private async analyzeDockerfiles(projectRoot: string, severity: Severity): Promise<Finding[]> {
    const findings: Finding[] = [];
    const dockerfiles = await this.findFiles(projectRoot, ['**/Dockerfile', '**/Dockerfile.*', '**/*.dockerfile']);

    for (const filePath of dockerfiles) {
      try {
        const content = await readFile(join(projectRoot, filePath), 'utf-8');
        const lines = content.split('\n');

        const hasUser = lines.some(l => /^\s*USER\s+/i.test(l));
        if (!hasUser && lines.some(l => /^\s*FROM\s+/i.test(l))) {
          findings.push(this.createFinding(
            'iac/docker-run-as-root',
            filePath, 1,
            'Dockerfile has no USER instruction — container runs as root',
            { severity },
          ));
        }

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNum = i + 1;

          if (/^\s*FROM\s+\S+:latest\b/i.test(line)) {
            findings.push(this.createFinding(
              'iac/docker-latest-tag', filePath, lineNum,
              'Avoid using :latest tag — pin to a specific version',
              { severity, codeSnippet: line.trim() },
            ));
          }

          if (/curl\s.*\|\s*(bash|sh)\b/i.test(line) || /wget\s.*\|\s*(bash|sh)\b/i.test(line)) {
            findings.push(this.createFinding(
              'iac/docker-curl-pipe-bash', filePath, lineNum,
              'Piping curl/wget to shell is dangerous — download and verify first',
              { severity, codeSnippet: line.trim() },
            ));
          }

          if (/^\s*ENV\s+(SECRET|PASSWORD|API_KEY|TOKEN|PRIVATE_KEY)\s*=/i.test(line)) {
            findings.push(this.createFinding(
              'iac/docker-exposed-secrets', filePath, lineNum,
              'Sensitive values should not be hardcoded in ENV — use build args or secrets',
              { severity, codeSnippet: line.trim() },
            ));
          }

          if (/^\s*ADD\s+(?!https?:\/\/)(?!\S+\.tar)/.test(line)) {
            findings.push(this.createFinding(
              'iac/docker-add-vs-copy', filePath, lineNum,
              'Use COPY instead of ADD for local files — ADD has unexpected behaviors',
              { severity, codeSnippet: line.trim() },
            ));
          }
        }

        const hasHealthcheck = lines.some(l => /^\s*HEALTHCHECK\s+/i.test(l));
        if (!hasHealthcheck && lines.some(l => /^\s*FROM\s+/i.test(l))) {
          findings.push(this.createFinding(
            'iac/docker-no-healthcheck', filePath, 1,
            'Dockerfile has no HEALTHCHECK instruction',
            { severity },
          ));
        }
      } catch {
        // File read failed
      }
    }

    return findings;
  }

  private async analyzeKubernetes(projectRoot: string, severity: Severity): Promise<Finding[]> {
    const findings: Finding[] = [];
    const yamlFiles = await this.findFiles(projectRoot, [
      '**/k8s/**/*.yml', '**/k8s/**/*.yaml',
      '**/kubernetes/**/*.yml', '**/kubernetes/**/*.yaml',
      '**/deploy/**/*.yml', '**/deploy/**/*.yaml',
    ]);

    for (const filePath of yamlFiles) {
      try {
        const content = await readFile(join(projectRoot, filePath), 'utf-8');
        const lines = content.split('\n');

        if (!content.includes('apiVersion:') && !content.includes('kind:')) continue;

        let hasResourceLimits = false;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNum = i + 1;

          if (/^\s*privileged:\s*true/i.test(line)) {
            findings.push(this.createFinding(
              'iac/k8s-privileged', filePath, lineNum,
              'Container running in privileged mode is a security risk',
              { severity, codeSnippet: line.trim() },
            ));
          }

          if (/^\s*image:\s*\S+:latest\s*$/i.test(line)) {
            findings.push(this.createFinding(
              'iac/k8s-latest-tag', filePath, lineNum,
              'Avoid using :latest tag for container images — pin to specific version',
              { severity, codeSnippet: line.trim() },
            ));
          }

          if (/^\s*resources:/.test(line)) {
            hasResourceLimits = true;
          }
        }

        if ((content.includes('kind: Deployment') || content.includes('kind: Pod') || content.includes('kind: StatefulSet')) && !hasResourceLimits) {
          findings.push(this.createFinding(
            'iac/k8s-no-resource-limits', filePath, 1,
            'No resource limits defined — could lead to resource exhaustion',
            { severity },
          ));
        }
      } catch {
        // File read failed
      }
    }

    return findings;
  }

  private async analyzeGitHubActions(projectRoot: string, severity: Severity): Promise<Finding[]> {
    const findings: Finding[] = [];
    const actionFiles = await this.findFiles(projectRoot, ['.github/workflows/*.yml', '.github/workflows/*.yaml']);

    for (const filePath of actionFiles) {
      try {
        const content = await readFile(join(projectRoot, filePath), 'utf-8');
        const lines = content.split('\n');

        let inRunBlock = false;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNum = i + 1;

          if (/^\s*run:\s*/.test(line)) {
            inRunBlock = true;
          } else if (/^\s*\w+:/.test(line) && !/^\s*-/.test(line)) {
            inRunBlock = false;
          }

          if (inRunBlock && /\$\{\{\s*github\.event\./.test(line)) {
            findings.push(this.createFinding(
              'iac/gha-script-injection', filePath, lineNum,
              'Potential script injection — github.event context in run block should use environment variables',
              { severity, codeSnippet: line.trim() },
            ));
          }

          if (/^\s*-?\s*uses:\s*\S+@(main|master|develop|dev)\s*$/.test(line)) {
            findings.push(this.createFinding(
              'iac/gha-mutable-action-ref', filePath, lineNum,
              'Pin GitHub Actions to a specific SHA instead of a mutable branch reference',
              { severity, codeSnippet: line.trim() },
            ));
          }
        }
      } catch {
        // File read failed
      }
    }

    return findings;
  }

  private async findFiles(projectRoot: string, patterns: string[]): Promise<string[]> {
    const allFiles = await this.walkDir(projectRoot, projectRoot);
    const matched = new Set<string>();
    for (const file of allFiles) {
      for (const pattern of patterns) {
        if (minimatch(file, pattern)) {
          matched.add(file);
        }
      }
    }
    return [...matched];
  }

  private async walkDir(dir: string, root: string, depth = 0): Promise<string[]> {
    if (depth > 5) return []; // prevent deep recursion
    const results: string[] = [];
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const fullPath = join(dir, entry.name);
        const relPath = relative(root, fullPath).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          results.push(...await this.walkDir(fullPath, root, depth + 1));
        } else {
          results.push(relPath);
        }
      }
    } catch {
      // Skip inaccessible directories
    }
    return results;
  }
}
