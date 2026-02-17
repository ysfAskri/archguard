import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { AnalysisContext, Finding } from '../core/types.js';
import { Severity } from '../core/types.js';
import { BaseAnalyzer } from './base-analyzer.js';
import type { SupportedLanguage } from '../core/types.js';

interface StructuralRule {
  id: string;
  language: string;
  rule: string;
  message: string;
  severity: string;
  fix?: string;
}

export class StructuralRuleAnalyzer extends BaseAnalyzer {
  name = 'structural-rules';

  protected defaultSeverity(): Severity {
    return Severity.Warning;
  }

  async analyze(context: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const rulesDir = context.config.rules?.astgrep;
    if (!rulesDir) return findings;

    const rulesPath = join(context.projectRoot, rulesDir);
    const rules = await this.loadRules(rulesPath);
    if (rules.length === 0) return findings;

    for (const file of context.parsedFiles) {
      const changedLines = this.getChangedLines(context, file.path);

      // Match rules to this file's language
      const applicableRules = rules.filter(r => this.languageMatches(r.language, file.language));

      for (const rule of applicableRules) {
        try {
          const matches = file.tree.root().findAll(rule.rule);
          for (const match of matches) {
            const lineNum = match.range().start.line + 1;
            if (changedLines.size > 0 && !changedLines.has(lineNum)) continue;

            findings.push(this.createFinding(
              `custom/${rule.id}`,
              file.path,
              lineNum,
              rule.message,
              {
                severity: this.parseSeverity(rule.severity),
                codeSnippet: match.text().substring(0, 100),
                suggestion: rule.fix,
              },
            ));
          }
        } catch {
          // Invalid pattern — skip silently
        }
      }
    }

    return findings;
  }

  private async loadRules(rulesDir: string): Promise<StructuralRule[]> {
    const rules: StructuralRule[] = [];

    try {
      const dirStat = await stat(rulesDir);
      if (!dirStat.isDirectory()) return rules;
    } catch {
      return rules;
    }

    try {
      const entries = await readdir(rulesDir);
      for (const entry of entries) {
        if (!entry.endsWith('.yml') && !entry.endsWith('.yaml')) continue;
        try {
          const content = await readFile(join(rulesDir, entry), 'utf-8');
          const parsed = parseYaml(content) as Partial<StructuralRule>;
          if (parsed.id && parsed.language && parsed.rule && parsed.message) {
            rules.push({
              id: parsed.id,
              language: parsed.language,
              rule: parsed.rule,
              message: parsed.message,
              severity: parsed.severity ?? 'warning',
              fix: parsed.fix,
            });
          }
        } catch {
          // Invalid YAML file — skip
        }
      }
    } catch {
      // Directory read failed
    }

    return rules;
  }

  private languageMatches(ruleLanguage: string, fileLanguage: SupportedLanguage): boolean {
    const aliases: Record<string, string[]> = {
      typescript: ['typescript', 'tsx'],
      javascript: ['javascript', 'jsx'],
      python: ['python'],
      go: ['go'],
      rust: ['rust'],
      java: ['java'],
    };
    const matching = aliases[ruleLanguage] ?? [ruleLanguage];
    return matching.includes(fileLanguage);
  }

  private parseSeverity(s: string): Severity {
    switch (s.toLowerCase()) {
      case 'error': return Severity.Error;
      case 'info': return Severity.Info;
      default: return Severity.Warning;
    }
  }
}
