import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LicenseScanner } from '../../src/analyzers/license-scanner.js';
import { Severity, type AnalysisContext, type ArchGuardConfig } from '../../src/core/types.js';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeConfig(allowed: string[] = [], denied: string[] = []): ArchGuardConfig {
  return {
    ...DEFAULT_CONFIG,
    analyzers: {
      ...DEFAULT_CONFIG.analyzers,
      licenses: { enabled: true, severity: Severity.Warning, allowed, denied },
    },
  };
}

function makeContext(projectRoot: string, config: ArchGuardConfig): AnalysisContext {
  return { files: [], parsedFiles: [], config, projectRoot };
}

describe('LicenseScanner', () => {
  const scanner = new LicenseScanner();
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `license-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('detects denied license', async () => {
    await writeFile(join(testDir, 'package.json'), JSON.stringify({
      dependencies: { 'gpl-pkg': '1.0.0' },
    }));

    // Mock fetch to return GPL license
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ license: 'GPL-3.0' }),
    }));

    const config = makeConfig(['MIT'], ['GPL-*']);
    const ctx = makeContext(testDir, config);
    const findings = await scanner.analyze(ctx);
    expect(findings.some(f => f.ruleId === 'license/incompatible-license')).toBe(true);
  });

  it('flags license not in allowed list', async () => {
    await writeFile(join(testDir, 'package.json'), JSON.stringify({
      dependencies: { 'weird-pkg': '1.0.0' },
    }));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ license: 'WTFPL' }),
    }));

    const config = makeConfig(['MIT', 'Apache-2.0'], []);
    const ctx = makeContext(testDir, config);
    const findings = await scanner.analyze(ctx);
    expect(findings.some(f => f.ruleId === 'license/incompatible-license')).toBe(true);
  });

  it('passes when license is allowed', async () => {
    await writeFile(join(testDir, 'package.json'), JSON.stringify({
      dependencies: { 'good-pkg': '1.0.0' },
    }));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ license: 'MIT' }),
    }));

    const config = makeConfig(['MIT', 'Apache-2.0'], []);
    const ctx = makeContext(testDir, config);
    const findings = await scanner.analyze(ctx);
    expect(findings.filter(f => f.ruleId === 'license/incompatible-license')).toHaveLength(0);
  });

  it('returns empty when disabled', async () => {
    const config = makeConfig();
    config.analyzers.licenses = { enabled: false, severity: Severity.Warning, allowed: [], denied: [] };
    const ctx = makeContext(testDir, config);
    const findings = await scanner.analyze(ctx);
    expect(findings).toHaveLength(0);
  });
});
