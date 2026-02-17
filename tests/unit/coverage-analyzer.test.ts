import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CoverageAnalyzer } from '../../src/analyzers/coverage-analyzer.js';
import { Severity, type AnalysisContext, type FileInfo, type ArchGuardConfig } from '../../src/core/types.js';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeConfig(reportPath: string, minCoverage = 80, minNew = 90): ArchGuardConfig {
  return {
    ...DEFAULT_CONFIG,
    analyzers: {
      ...DEFAULT_CONFIG.analyzers,
      coverage: {
        enabled: true, severity: Severity.Warning,
        reportPath, minCoverage, minNewCodeCoverage: minNew,
      },
    },
  };
}

function makeContext(projectRoot: string, config: ArchGuardConfig, files: FileInfo[] = []): AnalysisContext {
  return { files, parsedFiles: [], config, projectRoot };
}

describe('CoverageAnalyzer', () => {
  const analyzer = new CoverageAnalyzer();
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `cov-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('detects coverage below threshold from lcov', async () => {
    const lcov = `SF:src/app.ts
DA:1,1
DA:2,1
DA:3,0
DA:4,0
DA:5,0
DA:6,0
DA:7,0
DA:8,0
DA:9,0
DA:10,0
end_of_record`;
    await writeFile(join(testDir, 'lcov.info'), lcov);

    const config = makeConfig('lcov.info', 80);
    const ctx = makeContext(testDir, config);
    const findings = await analyzer.analyze(ctx);
    expect(findings.some(f => f.ruleId === 'coverage/below-threshold')).toBe(true);
  });

  it('passes when coverage meets threshold', async () => {
    const lcov = `SF:src/app.ts
DA:1,1
DA:2,1
DA:3,1
DA:4,1
DA:5,1
end_of_record`;
    await writeFile(join(testDir, 'lcov.info'), lcov);

    const config = makeConfig('lcov.info', 80);
    const ctx = makeContext(testDir, config);
    const findings = await analyzer.analyze(ctx);
    expect(findings.filter(f => f.ruleId === 'coverage/below-threshold')).toHaveLength(0);
  });

  it('detects uncovered new code', async () => {
    const lcov = `SF:src/app.ts
DA:1,1
DA:2,0
DA:3,0
end_of_record`;
    await writeFile(join(testDir, 'lcov.info'), lcov);

    const config = makeConfig('lcov.info', 0, 90);
    const fileInfo: FileInfo = {
      path: 'src/app.ts', language: 'typescript', status: 'modified',
      hunks: [],
      addedLines: [
        { lineNumber: 2, content: 'const x = 1;', type: 'added' },
        { lineNumber: 3, content: 'const y = 2;', type: 'added' },
      ],
      removedLines: [],
    };
    const ctx = makeContext(testDir, config, [fileInfo]);
    const findings = await analyzer.analyze(ctx);
    expect(findings.some(f => f.ruleId === 'coverage/uncovered-new-code')).toBe(true);
  });

  it('returns empty when report not found', async () => {
    const config = makeConfig('nonexistent.info');
    const ctx = makeContext(testDir, config);
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  it('parses Istanbul JSON format', async () => {
    const istanbul = JSON.stringify({
      'src/low.ts': {
        statementMap: {
          '0': { start: { line: 1 }, end: { line: 1 } },
          '1': { start: { line: 2 }, end: { line: 2 } },
          '2': { start: { line: 3 }, end: { line: 3 } },
          '3': { start: { line: 4 }, end: { line: 4 } },
          '4': { start: { line: 5 }, end: { line: 5 } },
        },
        s: { '0': 1, '1': 0, '2': 0, '3': 0, '4': 0 },
      },
    });
    await writeFile(join(testDir, 'coverage.json'), istanbul);

    const config = makeConfig('coverage.json', 80);
    const ctx = makeContext(testDir, config);
    const findings = await analyzer.analyze(ctx);
    expect(findings.some(f => f.ruleId === 'coverage/below-threshold')).toBe(true);
  });
});
