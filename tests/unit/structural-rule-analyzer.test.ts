import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StructuralRuleAnalyzer } from '../../src/analyzers/structural-rule-analyzer.js';
import { Severity, type AnalysisContext, type FileInfo, type ParsedFile, type ArchGuardConfig } from '../../src/core/types.js';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeConfig(rulesDir: string): ArchGuardConfig {
  return {
    ...DEFAULT_CONFIG,
    rules: { astgrep: rulesDir },
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
    findAll: (pattern: string) => {
      // Simple mock: return match if source contains the literal text
      if (source.includes('console.log')) {
        return [{
          text: () => 'console.log("test")',
          range: () => ({ start: { line: 0, column: 0 }, end: { line: 0, column: 20 } }),
        }];
      }
      return [];
    },
  };
  return { root: () => rootNode };
}

function makeContext(source: string, config: ArchGuardConfig, filePath = 'test.ts'): AnalysisContext {
  const lines = source.split('\n');
  const addedLines = lines.map((content, i) => ({
    lineNumber: i + 1, content, type: 'added' as const,
  }));

  return {
    files: [{
      path: filePath, language: 'typescript', status: 'added',
      hunks: [], addedLines, removedLines: [], content: source,
    }],
    parsedFiles: [{
      path: filePath, language: 'typescript',
      tree: createMockTree(source), content: source,
    }],
    config,
    projectRoot: '/tmp/test',
  };
}

describe('StructuralRuleAnalyzer', () => {
  const analyzer = new StructuralRuleAnalyzer();
  let testDir: string;
  let rulesDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `struct-test-${Date.now()}`);
    rulesDir = join(testDir, 'rules');
    await mkdir(rulesDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('loads and applies YAML rules', async () => {
    await writeFile(join(rulesDir, 'no-console.yml'), `id: no-console-log
language: typescript
rule: "console.log($$$ARGS)"
message: "Avoid console.log in production code"
severity: warning`);

    const config = makeConfig('rules/');
    config.rules = { astgrep: 'rules/' };

    const ctx = makeContext('console.log("hello")', config);
    // Override projectRoot to the test dir so it finds the rules
    ctx.projectRoot = testDir;
    const findings = await analyzer.analyze(ctx);
    expect(findings.some(f => f.ruleId === 'custom/no-console-log')).toBe(true);
  });

  it('returns empty when no rules directory', async () => {
    const config = makeConfig('/nonexistent/dir');
    config.rules = { astgrep: '/nonexistent/dir' };
    const ctx = makeContext('console.log("test")', config);
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  it('skips invalid YAML rule files', async () => {
    await writeFile(join(rulesDir, 'bad.yml'), 'this is not valid yaml: [');

    const config = makeConfig('rules/');
    config.rules = { astgrep: rulesDir };
    const ctx = makeContext('const x = 1;', config);
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  it('returns empty when no astgrep config', async () => {
    const config = { ...DEFAULT_CONFIG };
    const ctx = makeContext('console.log("test")', config);
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });
});
