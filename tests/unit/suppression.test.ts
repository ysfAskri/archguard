import { describe, it, expect } from 'vitest';
import { parseSuppressionDirectives, applySuppression } from '../../src/core/suppression.js';
import { Severity, type Finding, type ParsedFile } from '../../src/core/types.js';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'security/xss',
    analyzer: 'security',
    severity: Severity.Warning,
    message: 'XSS risk',
    file: 'src/foo.ts',
    line: 5,
    ...overrides,
  };
}

function makeParsedFile(content: string, overrides: Partial<ParsedFile> = {}): ParsedFile {
  return {
    path: 'src/foo.ts',
    language: 'typescript',
    tree: {} as any,
    content,
    ...overrides,
  };
}

describe('parseSuppressionDirectives', () => {
  it('parses // archguard-ignore (next line, all rules)', () => {
    const content = `line1\n// archguard-ignore\nflaggedLine`;
    const directives = parseSuppressionDirectives(content, 'typescript');
    expect(directives).toEqual([{ targetLine: 3, ruleId: null }]);
  });

  it('parses // archguard-ignore with specific rule', () => {
    const content = `line1\n// archguard-ignore security/xss\nflaggedLine`;
    const directives = parseSuppressionDirectives(content, 'typescript');
    expect(directives).toEqual([{ targetLine: 3, ruleId: 'security/xss' }]);
  });

  it('parses // archguard-ignore-line (same line, all rules)', () => {
    const content = `line1\nflaggedLine // archguard-ignore-line\nline3`;
    const directives = parseSuppressionDirectives(content, 'typescript');
    expect(directives).toEqual([{ targetLine: 2, ruleId: null }]);
  });

  it('parses // archguard-ignore-line with specific rule', () => {
    const content = `flaggedLine // archguard-ignore-line security/xss`;
    const directives = parseSuppressionDirectives(content, 'typescript');
    expect(directives).toEqual([{ targetLine: 1, ruleId: 'security/xss' }]);
  });

  it('parses /* archguard-ignore */ block comment', () => {
    const content = `line1\n/* archguard-ignore */\nflaggedLine`;
    const directives = parseSuppressionDirectives(content, 'typescript');
    expect(directives).toEqual([{ targetLine: 3, ruleId: null }]);
  });

  it('parses /* archguard-ignore-line */ block comment on same line', () => {
    const content = `flaggedLine /* archguard-ignore-line security/xss */`;
    const directives = parseSuppressionDirectives(content, 'typescript');
    expect(directives).toEqual([{ targetLine: 1, ruleId: 'security/xss' }]);
  });

  it('parses # archguard-ignore for Python', () => {
    const content = `line1\n# archguard-ignore\nflagged_line`;
    const directives = parseSuppressionDirectives(content, 'python');
    expect(directives).toEqual([{ targetLine: 3, ruleId: null }]);
  });

  it('parses # archguard-ignore-line for Python', () => {
    const content = `flagged_line # archguard-ignore-line ai-smells/unused-import`;
    const directives = parseSuppressionDirectives(content, 'python');
    expect(directives).toEqual([{ targetLine: 1, ruleId: 'ai-smells/unused-import' }]);
  });

  it('does not match # comments for non-Python languages', () => {
    const content = `# archguard-ignore\nflaggedLine`;
    const directives = parseSuppressionDirectives(content, 'typescript');
    expect(directives).toEqual([]);
  });

  it('does not match // comments for Python', () => {
    const content = `// archguard-ignore\nflagged_line`;
    const directives = parseSuppressionDirectives(content, 'python');
    expect(directives).toEqual([]);
  });

  it('returns empty array when no directives present', () => {
    const content = `const x = 1;\nconst y = 2;`;
    const directives = parseSuppressionDirectives(content, 'typescript');
    expect(directives).toEqual([]);
  });

  it('handles multiple directives in same file', () => {
    const content = [
      '// archguard-ignore security/xss',
      'line2',
      'line3 // archguard-ignore-line',
      '// archguard-ignore',
      'line5',
    ].join('\n');
    const directives = parseSuppressionDirectives(content, 'typescript');
    expect(directives).toEqual([
      { targetLine: 2, ruleId: 'security/xss' },
      { targetLine: 3, ruleId: null },
      { targetLine: 5, ruleId: null },
    ]);
  });

  it('does not confuse archguard-ignore with archguard-ignore-line', () => {
    const content = `// archguard-ignore-line security/xss`;
    // This is on line 1, same-line directive
    const directives = parseSuppressionDirectives(content, 'typescript');
    // Should only produce a same-line directive, not a next-line one
    expect(directives).toEqual([{ targetLine: 1, ruleId: 'security/xss' }]);
  });
});

describe('applySuppression', () => {
  it('suppresses finding on matching line (all rules)', () => {
    const findings = [makeFinding({ line: 3 })];
    const parsedFiles = [makeParsedFile('line1\n// archguard-ignore\nflaggedLine')];

    const result = applySuppression(findings, parsedFiles);
    expect(result.findings).toHaveLength(0);
    expect(result.suppressedCount).toBe(1);
  });

  it('suppresses finding matching specific rule', () => {
    const findings = [
      makeFinding({ line: 3, ruleId: 'security/xss' }),
      makeFinding({ line: 3, ruleId: 'security/eval' }),
    ];
    const parsedFiles = [makeParsedFile('line1\n// archguard-ignore security/xss\nflaggedLine')];

    const result = applySuppression(findings, parsedFiles);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].ruleId).toBe('security/eval');
    expect(result.suppressedCount).toBe(1);
  });

  it('does not suppress findings on non-matching lines', () => {
    const findings = [makeFinding({ line: 1 })];
    const parsedFiles = [makeParsedFile('flaggedLine\n// archguard-ignore\nline3')];

    const result = applySuppression(findings, parsedFiles);
    expect(result.findings).toHaveLength(1);
    expect(result.suppressedCount).toBe(0);
  });

  it('does not suppress when rule ID does not match', () => {
    const findings = [makeFinding({ line: 3, ruleId: 'security/eval' })];
    const parsedFiles = [makeParsedFile('line1\n// archguard-ignore security/xss\nflaggedLine')];

    const result = applySuppression(findings, parsedFiles);
    expect(result.findings).toHaveLength(1);
    expect(result.suppressedCount).toBe(0);
  });

  it('suppresses same-line directive', () => {
    const findings = [makeFinding({ line: 1 })];
    const parsedFiles = [makeParsedFile('flaggedLine // archguard-ignore-line')];

    const result = applySuppression(findings, parsedFiles);
    expect(result.findings).toHaveLength(0);
    expect(result.suppressedCount).toBe(1);
  });

  it('handles files with no directives', () => {
    const findings = [makeFinding()];
    const parsedFiles = [makeParsedFile('const x = 1;')];

    const result = applySuppression(findings, parsedFiles);
    expect(result.findings).toHaveLength(1);
    expect(result.suppressedCount).toBe(0);
  });

  it('handles findings in files without parsed content', () => {
    const findings = [makeFinding({ file: 'other.ts' })];
    const parsedFiles = [makeParsedFile('// archguard-ignore\nline2')];

    const result = applySuppression(findings, parsedFiles);
    expect(result.findings).toHaveLength(1);
    expect(result.suppressedCount).toBe(0);
  });

  it('handles empty findings array', () => {
    const parsedFiles = [makeParsedFile('// archguard-ignore\nline2')];
    const result = applySuppression([], parsedFiles);
    expect(result.findings).toHaveLength(0);
    expect(result.suppressedCount).toBe(0);
  });
});
