import { describe, it, expect } from 'vitest';
import { TaintAnalyzer } from '../../src/analyzers/taint-analyzer.js';
import { parseSource } from '../../src/parsers/tree-sitter-manager.js';
import { Severity, type AnalysisContext, type ArchGuardConfig, type FileInfo, type ParsedFile } from '../../src/core/types.js';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';

function makeContext(content: string, path = 'src/app.ts'): AnalysisContext {
  const lines = content.split('\n');
  const file: FileInfo = {
    path,
    language: 'typescript',
    status: 'added',
    hunks: [],
    addedLines: lines.map((c, i) => ({ lineNumber: i + 1, content: c, type: 'added' as const })),
    removedLines: [],
    content,
  };
  const parsed: ParsedFile = {
    path,
    language: 'typescript',
    tree: parseSource('typescript', content),
    content,
  };
  const config: ArchGuardConfig = {
    ...DEFAULT_CONFIG,
    analyzers: {
      ...DEFAULT_CONFIG.analyzers,
      taint: { enabled: true, severity: Severity.Error },
    },
  };
  return { files: [file], parsedFiles: [parsed], config, projectRoot: '/project' };
}

describe('TaintAnalyzer', () => {
  const analyzer = new TaintAnalyzer();

  it('detects tainted data in eval', async () => {
    const code = `
const input = req.query.name;
eval(input);
`;
    const findings = await analyzer.analyze(makeContext(code));
    expect(findings.some(f => f.ruleId === 'taint/command-injection')).toBe(true);
  });

  it('detects tainted data in innerHTML', async () => {
    const code = `
const userInput = req.body.html;
element.innerHTML = userInput;
`;
    const findings = await analyzer.analyze(makeContext(code));
    expect(findings.some(f => f.ruleId === 'taint/xss')).toBe(true);
  });

  it('does not flag sanitized inputs', async () => {
    const code = `
const input = req.query.name;
const safe = encodeURIComponent(input);
eval(safe);
`;
    const findings = await analyzer.analyze(makeContext(code));
    // Should not flag because encodeURIComponent is a sanitizer
    const taintFindings = findings.filter(f => f.ruleId.startsWith('taint/'));
    expect(taintFindings).toHaveLength(0);
  });

  it('reports nothing when disabled', async () => {
    const config: ArchGuardConfig = { ...DEFAULT_CONFIG };
    const context: AnalysisContext = { files: [], parsedFiles: [], config, projectRoot: '/project' };
    const findings = await analyzer.analyze(context);
    expect(findings).toHaveLength(0);
  });
});
