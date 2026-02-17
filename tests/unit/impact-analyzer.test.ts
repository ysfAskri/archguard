import { describe, it, expect } from 'vitest';
import { ImpactAnalyzer } from '../../src/analyzers/impact-analyzer.js';
import { parseSource } from '../../src/parsers/tree-sitter-manager.js';
import { Severity, type AnalysisContext, type ArchGuardConfig, type FileInfo, type ParsedFile } from '../../src/core/types.js';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';

function makeContext(files: FileInfo[], parsedFiles: ParsedFile[]): AnalysisContext {
  const config: ArchGuardConfig = {
    ...DEFAULT_CONFIG,
    analyzers: {
      ...DEFAULT_CONFIG.analyzers,
      impact: { enabled: true, severity: Severity.Info, depth: 2 },
    },
  };
  return { files, parsedFiles, config, projectRoot: '/project' };
}

function makeParsedFile(path: string, content: string): ParsedFile {
  return { path, language: 'typescript', tree: parseSource('typescript', content), content };
}

function makeFileInfo(path: string, content: string): FileInfo {
  const lines = content.split('\n');
  return {
    path,
    language: 'typescript',
    status: 'modified',
    hunks: [],
    addedLines: lines.map((c, i) => ({ lineNumber: i + 1, content: c, type: 'added' as const })),
    removedLines: [],
    content,
  };
}

describe('ImpactAnalyzer', () => {
  it('reports downstream consumers for changed files', async () => {
    const aContent = `import { b } from './b.js';\nconsole.log(b);`;
    const bContent = `export const b = 1;`;

    const files = [makeFileInfo('src/b.ts', bContent)];
    const parsedFiles = [
      makeParsedFile('src/a.ts', aContent),
      makeParsedFile('src/b.ts', bContent),
    ];

    const analyzer = new ImpactAnalyzer();
    const context = makeContext(files, parsedFiles);
    const findings = await analyzer.analyze(context);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].ruleId).toBe('impact/downstream-consumers');
    expect(findings[0].message).toContain('src/a.ts');
  });

  it('reports nothing when disabled', async () => {
    const config: ArchGuardConfig = { ...DEFAULT_CONFIG };
    const context: AnalysisContext = { files: [], parsedFiles: [], config, projectRoot: '/project' };
    const analyzer = new ImpactAnalyzer();
    const findings = await analyzer.analyze(context);
    expect(findings).toHaveLength(0);
  });
});
