import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { collectDependencies } from '../../src/core/dependency-collector.js';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('dependency-collector', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `sbom-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('collects npm dependencies from package.json', async () => {
    await writeFile(join(testDir, 'package.json'), JSON.stringify({
      dependencies: { express: '^4.18.0', lodash: '~4.17.21' },
      devDependencies: { vitest: '^1.0.0' },
    }));

    const deps = await collectDependencies(testDir);
    expect(deps.length).toBe(3);
    expect(deps.some(d => d.name === 'express' && d.ecosystem === 'npm')).toBe(true);
    expect(deps.some(d => d.name === 'vitest' && d.ecosystem === 'npm')).toBe(true);
  });

  it('returns empty when no manifest files exist', async () => {
    const deps = await collectDependencies(testDir);
    expect(deps).toHaveLength(0);
  });

  it('collects go.mod dependencies', async () => {
    await writeFile(join(testDir, 'go.mod'), `module example.com/mymod

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/lib/pq v1.10.9
)`);

    const deps = await collectDependencies(testDir);
    expect(deps.some(d => d.name === 'github.com/gin-gonic/gin' && d.ecosystem === 'Go')).toBe(true);
  });

  it('strips version prefixes from npm versions', async () => {
    await writeFile(join(testDir, 'package.json'), JSON.stringify({
      dependencies: { react: '^18.2.0' },
    }));

    const deps = await collectDependencies(testDir);
    expect(deps[0].version).toBe('18.2.0');
  });
});
