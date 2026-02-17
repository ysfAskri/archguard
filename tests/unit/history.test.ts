import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { saveDetailedRun, loadDetailedRun, listRuns } from '../../src/metrics/history.js';
import type { AnalysisSummary } from '../../src/core/types.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'archguard-history-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function makeSummary(): AnalysisSummary {
  return {
    totalFiles: 5,
    totalFindings: 3,
    errors: 1,
    warnings: 2,
    infos: 0,
    duration: 150,
    analyzerResults: [
      {
        analyzer: 'security',
        findings: [
          { ruleId: 'security/xss', analyzer: 'security', severity: 'error' as const, message: 'XSS risk', file: 'src/a.ts', line: 10 },
        ],
        duration: 50,
      },
      {
        analyzer: 'conventions',
        findings: [
          { ruleId: 'convention/function-naming', analyzer: 'conventions', severity: 'warning' as const, message: 'Bad name', file: 'src/b.ts', line: 5 },
          { ruleId: 'convention/file-naming', analyzer: 'conventions', severity: 'warning' as const, message: 'Bad file', file: 'src/BadFile.ts', line: 1 },
        ],
        duration: 30,
      },
    ],
  };
}

describe('saveDetailedRun', () => {
  it('saves and returns run ID', async () => {
    const id = await saveDetailedRun(tempDir, makeSummary(), 'scan');
    expect(id).toBeTruthy();
    expect(id).toContain('scan');
  });
});

describe('loadDetailedRun', () => {
  it('loads saved run by ID', async () => {
    const id = await saveDetailedRun(tempDir, makeSummary(), 'scan');
    const run = await loadDetailedRun(tempDir, id);

    expect(run).not.toBeNull();
    expect(run!.id).toBe(id);
    expect(run!.command).toBe('scan');
    expect(run!.totalFiles).toBe(5);
    expect(run!.totalFindings).toBe(3);
    expect(run!.findings).toHaveLength(3);
    expect(run!.byAnalyzer['security']).toBe(1);
    expect(run!.byAnalyzer['conventions']).toBe(2);
    expect(run!.byRule['security/xss']).toBe(1);
    expect(run!.byFile['src/a.ts']).toBe(1);
  });

  it('returns null for non-existent run', async () => {
    const run = await loadDetailedRun(tempDir, 'nonexistent');
    expect(run).toBeNull();
  });
});

describe('listRuns', () => {
  it('lists saved runs sorted by timestamp', async () => {
    await saveDetailedRun(tempDir, makeSummary(), 'scan');
    // Small delay to ensure different timestamps
    await new Promise(r => setTimeout(r, 10));
    await saveDetailedRun(tempDir, makeSummary(), 'check');

    const runs = await listRuns(tempDir);
    expect(runs).toHaveLength(2);
    // Most recent first
    expect(runs[0].command).toBe('check');
    expect(runs[1].command).toBe('scan');
  });

  it('returns empty array when no history', async () => {
    const runs = await listRuns(tempDir);
    expect(runs).toHaveLength(0);
  });
});
