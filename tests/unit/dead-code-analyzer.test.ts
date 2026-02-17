import { describe, it, expect } from 'vitest';
import { DeadCodeAnalyzer } from '../../src/analyzers/dead-code-analyzer.js';
import { Severity, type AnalysisContext, type FileInfo, type ParsedFile, type ArchGuardConfig } from '../../src/core/types.js';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';

function makeConfig(overrides: Record<string, any> = {}): ArchGuardConfig {
  return {
    ...DEFAULT_CONFIG,
    analyzers: {
      ...DEFAULT_CONFIG.analyzers,
      deadCode: { enabled: true, severity: Severity.Warning, ...overrides },
    },
  };
}

function createMockTree(source: string, exports: string[] = []): any {
  const rootNode: any = {
    kind: () => 'program',
    text: () => source,
    range: () => ({
      start: { line: 0, column: 0, index: 0 },
      end: { line: source.split('\n').length, column: 0, index: 0 },
    }),
    children: () => {
      // Create export_statement nodes with identifiers
      return exports.map(name => ({
        kind: () => 'export_statement',
        text: () => `export { ${name} }`,
        range: () => ({ start: { line: 0, column: 0 }, end: { line: 0, column: 10 } }),
        children: () => [{
          kind: () => 'identifier',
          text: () => name,
          range: () => ({ start: { line: 0, column: 0 }, end: { line: 0, column: name.length } }),
          children: () => [],
          field: () => null,
          parent: () => null,
        }],
        field: () => null,
        parent: () => null,
      }));
    },
    child: () => null,
    field: () => null,
    parent: () => null,
  };
  return { root: () => rootNode };
}

function makeMultiFileContext(files: Array<{ path: string; source: string; imports: string[]; exports: string[] }>, config?: ArchGuardConfig): AnalysisContext {
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

    // Build a mock tree that has import and export nodes
    const importNodes = file.imports.map(imp => ({
      kind: () => 'import_statement',
      text: () => `import { x } from '${imp}'`,
      range: () => ({ start: { line: 0, column: 0 }, end: { line: 0, column: 20 } }),
      children: () => [{
        kind: () => 'import_specifier',
        text: () => 'x',
        range: () => ({ start: { line: 0, column: 0 }, end: { line: 0, column: 1 } }),
        children: () => [],
        field: (name: string) => name === 'name' ? { text: () => 'x', kind: () => 'identifier', children: () => [], field: () => null, parent: () => null, range: () => ({ start: { line: 0, column: 0 }, end: { line: 0, column: 1 } }) } : null,
        parent: () => null,
      }],
      field: (name: string) => {
        if (name === 'source') return { text: () => `'${imp}'`, kind: () => 'string', children: () => [], field: () => null, parent: () => null, range: () => ({ start: { line: 0, column: 0 }, end: { line: 0, column: 1 } }) };
        return null;
      },
      parent: () => null,
    }));

    const exportNodes = file.exports.map(exp => ({
      kind: () => 'export_statement',
      text: () => `export { ${exp} }`,
      range: () => ({ start: { line: 0, column: 0 }, end: { line: 0, column: 10 } }),
      children: () => [{
        kind: () => 'identifier',
        text: () => exp,
        range: () => ({ start: { line: 0, column: 0 }, end: { line: 0, column: exp.length } }),
        children: () => [],
        field: () => null,
        parent: () => null,
      }],
      field: () => null,
      parent: () => null,
    }));

    const rootNode: any = {
      kind: () => 'program',
      text: () => file.source,
      range: () => ({ start: { line: 0, column: 0 }, end: { line: lines.length, column: 0 } }),
      children: () => [...importNodes, ...exportNodes],
      child: () => null,
      field: () => null,
      parent: () => null,
    };

    parsedFiles.push({
      path: file.path, language: 'typescript',
      tree: { root: () => rootNode } as any, content: file.source,
    });
  }

  return {
    files: fileInfos, parsedFiles,
    config: config ?? makeConfig(), projectRoot: '/tmp/test',
  };
}

describe('DeadCodeAnalyzer', () => {
  const analyzer = new DeadCodeAnalyzer();

  it('detects unused exports when file is never imported', async () => {
    const ctx = makeMultiFileContext([
      { path: 'src/utils.ts', source: 'export function unused() {}', imports: [], exports: ['unused'] },
      { path: 'src/app.ts', source: 'const x = 1;', imports: [], exports: [] },
    ]);
    const findings = await analyzer.analyze(ctx);
    expect(findings.some(f => f.ruleId === 'dead-code/unused-export')).toBe(true);
  });

  it('does not flag exports that are imported', async () => {
    const ctx = makeMultiFileContext([
      { path: 'src/utils.ts', source: 'export function used() {}', imports: [], exports: ['used'] },
      { path: 'src/app.ts', source: 'import { used } from "./utils.js"', imports: ['./utils.js'], exports: [] },
    ]);
    const findings = await analyzer.analyze(ctx);
    // The import from app.ts resolves to utils.ts, so utils.ts has importedBy = [app.ts]
    // This means unused-export should NOT be flagged
    expect(findings.filter(f => f.file === 'src/utils.ts')).toHaveLength(0);
  });

  it('skips entry points', async () => {
    const config = makeConfig({ entryPoints: ['src/index.ts'] });
    const ctx = makeMultiFileContext([
      { path: 'src/index.ts', source: 'export function main() {}', imports: [], exports: ['main'] },
    ], config);
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  it('skips test files', async () => {
    const ctx = makeMultiFileContext([
      { path: 'tests/utils.test.ts', source: 'export function testHelper() {}', imports: [], exports: ['testHelper'] },
    ]);
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  it('returns empty when disabled', async () => {
    const config = makeConfig();
    config.analyzers.deadCode = { enabled: false, severity: Severity.Warning };
    const ctx = makeMultiFileContext([
      { path: 'src/unused.ts', source: 'export const x = 1;', imports: [], exports: ['x'] },
    ], config);
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });
});
