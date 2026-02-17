import { describe, it, expect } from 'vitest';
import { formatGitHubAnnotation, formatAnnotations } from '../../src/ci/github-annotator.js';
import { Severity, type Finding, type AnalysisSummary } from '../../src/core/types.js';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'security/xss',
    analyzer: 'security',
    severity: Severity.Error,
    message: 'XSS risk: innerHTML assignment',
    file: 'src/foo.ts',
    line: 10,
    ...overrides,
  };
}

describe('formatGitHubAnnotation', () => {
  it('formats error annotation', () => {
    const annotation = formatGitHubAnnotation(makeFinding());
    expect(annotation).toBe('::error file=src/foo.ts,line=10,title=archguardian [security/xss]::XSS risk: innerHTML assignment');
  });

  it('formats warning annotation', () => {
    const annotation = formatGitHubAnnotation(makeFinding({ severity: Severity.Warning }));
    expect(annotation).toContain('::warning');
  });

  it('formats info annotation', () => {
    const annotation = formatGitHubAnnotation(makeFinding({ severity: Severity.Info }));
    expect(annotation).toContain('::notice');
  });

  it('includes endLine when present', () => {
    const annotation = formatGitHubAnnotation(makeFinding({ endLine: 15 }));
    expect(annotation).toContain('endLine=15');
  });

  it('includes column when present', () => {
    const annotation = formatGitHubAnnotation(makeFinding({ column: 5 }));
    expect(annotation).toContain('col=5');
  });
});

describe('formatAnnotations', () => {
  it('formats all findings as annotations', () => {
    const summary: AnalysisSummary = {
      totalFiles: 1,
      totalFindings: 2,
      errors: 1,
      warnings: 1,
      infos: 0,
      duration: 100,
      analyzerResults: [{
        analyzer: 'security',
        findings: [
          makeFinding(),
          makeFinding({ severity: Severity.Warning, ruleId: 'ai-smell/unused-import', message: 'Unused import', line: 5 }),
        ],
        duration: 50,
      }],
    };

    const result = formatAnnotations(summary);
    const lines = result.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('::error');
    expect(lines[1]).toContain('::warning');
  });

  it('returns empty string for no findings', () => {
    const summary: AnalysisSummary = {
      totalFiles: 0,
      totalFindings: 0,
      errors: 0,
      warnings: 0,
      infos: 0,
      duration: 10,
      analyzerResults: [],
    };

    expect(formatAnnotations(summary)).toBe('');
  });
});
