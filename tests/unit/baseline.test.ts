import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { saveBaseline, loadBaseline, filterByBaseline } from '../../src/core/baseline.js';
import { Severity, type Finding } from '../../src/core/types.js';
import type { BaselineFile } from '../../src/core/baseline.js';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'security/xss',
    analyzer: 'security',
    severity: Severity.Warning,
    message: 'XSS risk: innerHTML assignment',
    file: 'src/foo.ts',
    line: 10,
    ...overrides,
  };
}

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'archguard-baseline-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('saveBaseline', () => {
  it('saves baseline file with correct format', async () => {
    const findings = [makeFinding(), makeFinding({ ruleId: 'security/eval', message: 'eval usage', line: 20 })];
    const path = await saveBaseline(tempDir, findings, 'scan');

    const content = JSON.parse(await readFile(path, 'utf-8')) as BaselineFile;
    expect(content.version).toBe(1);
    expect(content.generatedBy).toBe('scan');
    expect(content.generatedAt).toBeTruthy();
    expect(content.findings).toHaveLength(2);
    expect(content.findings[0]).toEqual({
      ruleId: 'security/xss',
      file: 'src/foo.ts',
      message: 'XSS risk: innerHTML assignment',
    });
  });

  it('saves to custom path', async () => {
    const findings = [makeFinding()];
    const path = await saveBaseline(tempDir, findings, 'scan', 'custom-baseline.json');

    expect(path).toBe(join(tempDir, 'custom-baseline.json'));
    const content = JSON.parse(await readFile(path, 'utf-8'));
    expect(content.findings).toHaveLength(1);
  });

  it('does not include line numbers in baseline entries', async () => {
    const findings = [makeFinding({ line: 42 })];
    const path = await saveBaseline(tempDir, findings, 'scan');

    const content = JSON.parse(await readFile(path, 'utf-8'));
    expect(content.findings[0]).not.toHaveProperty('line');
  });
});

describe('loadBaseline', () => {
  it('loads existing baseline', async () => {
    const findings = [makeFinding()];
    await saveBaseline(tempDir, findings, 'scan');

    const loaded = await loadBaseline(tempDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(1);
    expect(loaded!.findings).toHaveLength(1);
  });

  it('returns null when no baseline exists', async () => {
    const loaded = await loadBaseline(tempDir);
    expect(loaded).toBeNull();
  });

  it('loads from custom path', async () => {
    await saveBaseline(tempDir, [makeFinding()], 'scan', 'my-baseline.json');

    const loaded = await loadBaseline(tempDir, 'my-baseline.json');
    expect(loaded).not.toBeNull();
    expect(loaded!.findings).toHaveLength(1);
  });
});

describe('filterByBaseline', () => {
  it('filters out findings matching baseline by ruleId+file+message', () => {
    const baseline: BaselineFile = {
      version: 1,
      generatedAt: '2026-01-01T00:00:00Z',
      generatedBy: 'scan',
      findings: [{ ruleId: 'security/xss', file: 'src/foo.ts', message: 'XSS risk: innerHTML assignment' }],
    };

    const findings = [
      makeFinding({ line: 10 }),
      makeFinding({ ruleId: 'security/eval', message: 'eval usage', line: 20 }),
    ];

    const result = filterByBaseline(findings, baseline);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].ruleId).toBe('security/eval');
    expect(result.baselineSuppressedCount).toBe(1);
  });

  it('survives line number drift', () => {
    const baseline: BaselineFile = {
      version: 1,
      generatedAt: '2026-01-01T00:00:00Z',
      generatedBy: 'scan',
      findings: [{ ruleId: 'security/xss', file: 'src/foo.ts', message: 'XSS risk: innerHTML assignment' }],
    };

    // Same finding but at a different line number
    const findings = [makeFinding({ line: 52 })];

    const result = filterByBaseline(findings, baseline);
    expect(result.findings).toHaveLength(0);
    expect(result.baselineSuppressedCount).toBe(1);
  });

  it('does not suppress findings with different message', () => {
    const baseline: BaselineFile = {
      version: 1,
      generatedAt: '2026-01-01T00:00:00Z',
      generatedBy: 'scan',
      findings: [{ ruleId: 'security/xss', file: 'src/foo.ts', message: 'XSS risk: innerHTML assignment' }],
    };

    const findings = [makeFinding({ message: 'XSS risk: document.write call' })];

    const result = filterByBaseline(findings, baseline);
    expect(result.findings).toHaveLength(1);
    expect(result.baselineSuppressedCount).toBe(0);
  });

  it('does not suppress findings with different file', () => {
    const baseline: BaselineFile = {
      version: 1,
      generatedAt: '2026-01-01T00:00:00Z',
      generatedBy: 'scan',
      findings: [{ ruleId: 'security/xss', file: 'src/foo.ts', message: 'XSS risk: innerHTML assignment' }],
    };

    const findings = [makeFinding({ file: 'src/bar.ts' })];

    const result = filterByBaseline(findings, baseline);
    expect(result.findings).toHaveLength(1);
    expect(result.baselineSuppressedCount).toBe(0);
  });

  it('handles empty baseline', () => {
    const baseline: BaselineFile = {
      version: 1,
      generatedAt: '2026-01-01T00:00:00Z',
      generatedBy: 'scan',
      findings: [],
    };

    const findings = [makeFinding()];
    const result = filterByBaseline(findings, baseline);
    expect(result.findings).toHaveLength(1);
    expect(result.baselineSuppressedCount).toBe(0);
  });

  it('handles empty findings', () => {
    const baseline: BaselineFile = {
      version: 1,
      generatedAt: '2026-01-01T00:00:00Z',
      generatedBy: 'scan',
      findings: [{ ruleId: 'security/xss', file: 'src/foo.ts', message: 'XSS risk' }],
    };

    const result = filterByBaseline([], baseline);
    expect(result.findings).toHaveLength(0);
    expect(result.baselineSuppressedCount).toBe(0);
  });
});

describe('round-trip save/load', () => {
  it('preserves data through save and load cycle', async () => {
    const findings = [
      makeFinding(),
      makeFinding({ ruleId: 'ai-smells/unused-import', message: 'Unused import: foo', file: 'src/bar.ts', line: 3 }),
    ];

    await saveBaseline(tempDir, findings, 'check');
    const loaded = await loadBaseline(tempDir);

    expect(loaded).not.toBeNull();
    expect(loaded!.findings).toHaveLength(2);

    // Filter should suppress both original findings
    const result = filterByBaseline(findings, loaded!);
    expect(result.findings).toHaveLength(0);
    expect(result.baselineSuppressedCount).toBe(2);
  });
});
