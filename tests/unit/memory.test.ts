import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadMemory, saveMemory, addMemoryEntry, applyMemory } from '../../src/core/memory.js';
import { Severity, type Finding } from '../../src/core/types.js';
import type { MemoryFile } from '../../src/core/memory.js';

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
  tempDir = await mkdtemp(join(tmpdir(), 'archguard-memory-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('loadMemory', () => {
  it('returns empty memory when no file exists', async () => {
    const memory = await loadMemory(tempDir);
    expect(memory.version).toBe(1);
    expect(memory.entries).toHaveLength(0);
  });

  it('loads saved memory', async () => {
    const memory: MemoryFile = { version: 1, entries: [] };
    addMemoryEntry(memory, 'security/xss', 'innerHTML', 'message');
    await saveMemory(tempDir, memory);

    const loaded = await loadMemory(tempDir);
    expect(loaded.entries).toHaveLength(1);
    expect(loaded.entries[0].ruleId).toBe('security/xss');
  });
});

describe('addMemoryEntry', () => {
  it('adds new entry', () => {
    const memory: MemoryFile = { version: 1, entries: [] };
    addMemoryEntry(memory, 'security/xss', 'innerHTML', 'message');
    expect(memory.entries).toHaveLength(1);
    expect(memory.entries[0].count).toBe(1);
  });

  it('increments count for duplicate entry', () => {
    const memory: MemoryFile = { version: 1, entries: [] };
    addMemoryEntry(memory, 'security/xss', 'innerHTML', 'message');
    addMemoryEntry(memory, 'security/xss', 'innerHTML', 'message');
    expect(memory.entries).toHaveLength(1);
    expect(memory.entries[0].count).toBe(2);
  });

  it('distinguishes by pattern type', () => {
    const memory: MemoryFile = { version: 1, entries: [] };
    addMemoryEntry(memory, 'security/xss', 'innerHTML', 'message');
    addMemoryEntry(memory, 'security/xss', 'innerHTML', 'file');
    expect(memory.entries).toHaveLength(2);
  });
});

describe('applyMemory', () => {
  it('suppresses findings matching message pattern', () => {
    const memory: MemoryFile = {
      version: 1,
      entries: [{ ruleId: 'security/xss', pattern: 'innerHTML', patternType: 'message', dismissedAt: '', count: 1 }],
    };
    const findings = [makeFinding(), makeFinding({ ruleId: 'security/eval', message: 'eval usage' })];
    const result = applyMemory(findings, memory);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].ruleId).toBe('security/eval');
    expect(result.memorySuppressedCount).toBe(1);
  });

  it('suppresses findings matching file glob pattern', () => {
    const memory: MemoryFile = {
      version: 1,
      entries: [{ ruleId: 'security/xss', pattern: 'src/**/*.ts', patternType: 'file', dismissedAt: '', count: 1 }],
    };
    const findings = [makeFinding({ file: 'src/foo.ts' }), makeFinding({ file: 'lib/bar.ts' })];
    const result = applyMemory(findings, memory);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].file).toBe('lib/bar.ts');
  });

  it('wildcard ruleId suppresses all rules', () => {
    const memory: MemoryFile = {
      version: 1,
      entries: [{ ruleId: '*', pattern: 'innerHTML', patternType: 'message', dismissedAt: '', count: 1 }],
    };
    const findings = [makeFinding(), makeFinding({ ruleId: 'ai-smell/unused-import', message: 'innerHTML leftover' })];
    const result = applyMemory(findings, memory);
    expect(result.findings).toHaveLength(0);
    expect(result.memorySuppressedCount).toBe(2);
  });

  it('returns all findings when memory is empty', () => {
    const memory: MemoryFile = { version: 1, entries: [] };
    const findings = [makeFinding(), makeFinding({ ruleId: 'security/eval' })];
    const result = applyMemory(findings, memory);
    expect(result.findings).toHaveLength(2);
    expect(result.memorySuppressedCount).toBe(0);
  });
});
