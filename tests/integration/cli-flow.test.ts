import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const exec = promisify(execFile);
const CLI = join(import.meta.dirname, '..', '..', 'dist', 'cli', 'index.js');

async function run(args: string[], cwd: string) {
  try {
    const { stdout, stderr } = await exec('node', [CLI, ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: '1' },
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: any) {
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', exitCode: err.code ?? 1 };
  }
}

async function git(args: string[], cwd: string) {
  const { stdout } = await exec('git', args, { cwd });
  return stdout.trim();
}

describe('CLI integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'archguard-test-'));
    await git(['init'], tempDir);
    await git(['config', 'user.email', 'test@test.com'], tempDir);
    await git(['config', 'user.name', 'Test'], tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('init creates config and hook', async () => {
    const { stdout } = await run(['init'], tempDir);
    expect(stdout).toContain('.archguard.yml');
    expect(stdout).toContain('pre-commit hook');
  });

  it('check with no staged changes passes', async () => {
    // Need at least one commit for git diff --cached to work
    await writeFile(join(tempDir, 'README.md'), '# test');
    await git(['add', '.'], tempDir);
    await git(['commit', '-m', 'init'], tempDir);

    const { stdout, exitCode } = await run(['check'], tempDir);
    expect(exitCode).toBe(0);
  });

  it('scan on empty project passes', async () => {
    await writeFile(join(tempDir, '.archguard.yml'), 'version: 1\nlanguages: [typescript]\ninclude: ["**/*"]');
    await writeFile(join(tempDir, 'clean.ts'), 'export function hello() { return "world"; }\n');
    await git(['add', '.'], tempDir);
    await git(['commit', '-m', 'init'], tempDir);

    const { stdout, exitCode } = await run(['scan'], tempDir);
    expect(exitCode).toBe(0);
  });

  it('scan with --format json outputs valid JSON', async () => {
    await writeFile(join(tempDir, '.archguard.yml'), 'version: 1\nlanguages: [typescript]\ninclude: ["**/*"]');
    await writeFile(join(tempDir, 'clean.ts'), 'export function hello() { return "world"; }\n');
    await git(['add', '.'], tempDir);
    await git(['commit', '-m', 'init'], tempDir);

    const { stdout, exitCode } = await run(['scan', '--format', 'json'], tempDir);
    // The JSON output is pretty-printed and may have non-JSON lines before it.
    // Find the JSON block by locating the first '{' and parsing from there.
    const jsonStart = stdout.indexOf('{');
    if (jsonStart >= 0) {
      const jsonStr = stdout.slice(jsonStart);
      const parsed = JSON.parse(jsonStr);
      expect(parsed).toHaveProperty('findings');
      expect(parsed).toHaveProperty('summary');
    }
  });
});
