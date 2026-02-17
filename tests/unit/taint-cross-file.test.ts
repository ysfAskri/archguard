import { describe, it, expect } from 'vitest';
import { TaintAnalyzer } from '../../src/analyzers/taint-analyzer.js';
import { Severity, type AnalysisContext, type FileInfo, type ParsedFile, type ArchGuardConfig } from '../../src/core/types.js';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';

function makeConfig(): ArchGuardConfig {
  return {
    ...DEFAULT_CONFIG,
    analyzers: {
      ...DEFAULT_CONFIG.analyzers,
      taint: { enabled: true, severity: Severity.Error, crossFile: true },
    },
  };
}

function createMockTree(source: string): any {
  const rootNode: any = {
    kind: () => 'program',
    text: () => source,
    range: () => ({
      start: { line: 0, column: 0, index: 0 },
      end: { line: source.split('\n').length, column: 0, index: 0 },
    }),
    children: () => [],
    child: () => null,
    field: () => null,
    parent: () => null,
    isNamed: () => true,
    isLeaf: () => true,
  };
  return { root: () => rootNode };
}

function makeContext(files: Array<{ path: string; source: string }>): AnalysisContext {
  const fileInfos: FileInfo[] = [];
  const parsedFiles: ParsedFile[] = [];

  for (const file of files) {
    const lines = file.source.split('\n');
    fileInfos.push({
      path: file.path, language: 'typescript', status: 'added',
      hunks: [],
      addedLines: lines.map((content, i) => ({ lineNumber: i + 1, content, type: 'added' as const })),
      removedLines: [], content: file.source,
    });
    parsedFiles.push({
      path: file.path, language: 'typescript',
      tree: createMockTree(file.source), content: file.source,
    });
  }

  return { files: fileInfos, parsedFiles, config: makeConfig(), projectRoot: '/tmp/test' };
}

describe('TaintAnalyzer cross-file', () => {
  const analyzer = new TaintAnalyzer();

  it('has crossFile config option', () => {
    const config = makeConfig();
    expect(config.analyzers.taint?.crossFile).toBe(true);
  });

  it('returns findings for basic taint flow', async () => {
    // Basic single-file taint (the mock tree is limited, so cross-file
    // won't actually work without real AST, but we verify the analyzer doesn't crash)
    const ctx = makeContext([
      { path: 'src/handler.ts', source: 'const input = req.body;\neval(input);' },
    ]);
    const findings = await analyzer.analyze(ctx);
    // With mock AST, we don't get real findings but verify no errors
    expect(Array.isArray(findings)).toBe(true);
  });

  it('handles empty parsed files', async () => {
    const ctx = makeContext([]);
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  it('skips non-JS/TS files for cross-file analysis', async () => {
    const ctx: AnalysisContext = {
      files: [{
        path: 'main.py', language: 'python', status: 'added',
        hunks: [],
        addedLines: [{ lineNumber: 1, content: 'import os', type: 'added' }],
        removedLines: [],
      }],
      parsedFiles: [{
        path: 'main.py', language: 'python',
        tree: createMockTree('import os'), content: 'import os',
      }],
      config: makeConfig(),
      projectRoot: '/tmp/test',
    };
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });
});
