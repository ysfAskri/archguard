import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const exec = promisify(execFile);
const CLI = join(import.meta.dirname, '..', '..', 'dist', 'cli', 'index.js');

// ── Helpers ──────────────────────────────────────────────────────

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

/**
 * Run a git command that may fail (e.g. a commit blocked by a hook),
 * returning stdout, stderr, and exit code instead of throwing.
 */
async function gitMayFail(args: string[], cwd: string) {
  try {
    const { stdout, stderr } = await exec('git', args, { cwd });
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: (err.stdout ?? '').trim(),
      stderr: (err.stderr ?? '').trim(),
      exitCode: err.code ?? 1,
    };
  }
}

// ── Config Templates ─────────────────────────────────────────────

/** Default config: security errors cause failure; warnings are tolerated. */
const DEFAULT_CONFIG = `\
version: 1
languages: [typescript, javascript, tsx, jsx]
include: ["**/*"]
exclude: ["**/node_modules/**", "**/dist/**"]

severity:
  failOn: error
  maxWarnings: 20

analyzers:
  security:
    enabled: true
    severity: error
  aiSmells:
    enabled: true
    severity: warning
    commentRatio: 0.4
  conventions:
    enabled: true
    severity: warning
    naming:
      functions: camelCase
      classes: PascalCase
      constants: UPPER_SNAKE
      files: kebab-case
    autoLearn: false
  duplicates:
    enabled: false
    similarity: 0.85
  architecture:
    enabled: false
    layers: []
    rules: []
`;

/** Strict config: warnings also cause failure (failOn: warning, maxWarnings: 0). */
const STRICT_CONFIG = `\
version: 1
languages: [typescript, javascript, tsx, jsx]
include: ["**/*"]
exclude: ["**/node_modules/**", "**/dist/**"]

severity:
  failOn: warning
  maxWarnings: 0

analyzers:
  security:
    enabled: true
    severity: error
  aiSmells:
    enabled: true
    severity: warning
    commentRatio: 0.4
  conventions:
    enabled: true
    severity: warning
    naming:
      functions: camelCase
      classes: PascalCase
      constants: UPPER_SNAKE
      files: kebab-case
    autoLearn: false
  duplicates:
    enabled: false
    similarity: 0.85
  architecture:
    enabled: false
    layers: []
    rules: []
`;

// ── Test Suite ──────────────────────────────────────────────────────

describe('E2E tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'archguard-e2e-'));
    await git(['init'], tempDir);
    await git(['config', 'user.email', 'test@test.com'], tempDir);
    await git(['config', 'user.name', 'Test'], tempDir);
    // Create an initial commit so that git diff --cached works properly
    await writeFile(join(tempDir, 'README.md'), '# test project\n');
    await git(['add', '.'], tempDir);
    await git(['commit', '-m', 'initial commit'], tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // ────────────────────────────────────────────────────────────────
  // 1. Security scanner catches hardcoded secrets (AWS key pattern)
  // ────────────────────────────────────────────────────────────────
  it('catches hardcoded AWS access key', async () => {
    await writeFile(join(tempDir, '.archguard.yml'), DEFAULT_CONFIG);

    // Create a file with a hardcoded AWS key
    await writeFile(
      join(tempDir, 'config.ts'),
      'const API_KEY = "AKIAIOSFODNN7EXAMPLE";\nexport default API_KEY;\n',
    );

    await git(['add', 'config.ts'], tempDir);

    const { stdout, exitCode } = await run(['check'], tempDir);

    expect(exitCode).not.toBe(0);
    expect(stdout).toContain('hardcoded');
    expect(stdout).toContain('AWS');
  }, 30_000);

  // ────────────────────────────────────────────────────────────────
  // 2. Security scanner catches eval() usage
  // ────────────────────────────────────────────────────────────────
  it('catches eval() usage', async () => {
    await writeFile(join(tempDir, '.archguard.yml'), DEFAULT_CONFIG);

    await writeFile(
      join(tempDir, 'dangerous.ts'),
      "const userInput = \"console.log('hi')\";\neval(userInput);\n",
    );

    await git(['add', 'dangerous.ts'], tempDir);

    const { stdout, exitCode } = await run(['check'], tempDir);

    expect(exitCode).not.toBe(0);
    expect(stdout).toContain('eval');
    expect(stdout).toContain('Dangerous');
  }, 30_000);

  // ────────────────────────────────────────────────────────────────
  // 3. AI smell detector catches unused imports
  // ────────────────────────────────────────────────────────────────
  it('catches unused imports', async () => {
    // Use strict config so warnings also fail
    await writeFile(join(tempDir, '.archguard.yml'), STRICT_CONFIG);

    await writeFile(
      join(tempDir, 'unused.ts'),
      [
        "import { readFile } from 'node:fs/promises';",
        "import { join } from 'node:path';",
        '',
        'const p = join("a", "b");',
        'console.log(p);',
        '',
      ].join('\n'),
    );

    await git(['add', 'unused.ts'], tempDir);

    const { stdout, exitCode } = await run(['check'], tempDir);

    // The unused import of readFile should be detected
    expect(stdout).toContain('Unused import');
    expect(stdout).toContain('readFile');
    // With failOn: warning and maxWarnings: 0, this should fail
    expect(exitCode).not.toBe(0);
  }, 30_000);

  // ────────────────────────────────────────────────────────────────
  // 4. Convention enforcer catches bad function naming
  // ────────────────────────────────────────────────────────────────
  it('catches PascalCase function when camelCase is required', async () => {
    // Use strict config so warnings also fail
    await writeFile(join(tempDir, '.archguard.yml'), STRICT_CONFIG);

    await writeFile(
      join(tempDir, 'naming.ts'),
      'export function MyBadFunc() {\n  return 42;\n}\n',
    );

    await git(['add', 'naming.ts'], tempDir);

    const { stdout, exitCode } = await run(['check'], tempDir);

    expect(stdout).toContain('MyBadFunc');
    expect(stdout).toContain('camelCase');
    expect(exitCode).not.toBe(0);
  }, 30_000);

  // ────────────────────────────────────────────────────────────────
  // 5. Pre-commit hook blocks bad commit (full E2E)
  // ────────────────────────────────────────────────────────────────
  it('pre-commit hook blocks a commit containing a secret', async () => {
    // Initialize archguardian (creates config + installs hook)
    await run(['init'], tempDir);

    // The default init config uses include: ["src/**"], so we overwrite
    // it with include: ["**/*"] to scan files in any directory.
    await writeFile(join(tempDir, '.archguard.yml'), DEFAULT_CONFIG);

    // Count commits before
    const logBefore = await git(['rev-list', '--count', 'HEAD'], tempDir);
    const commitCountBefore = parseInt(logBefore, 10);

    // Create a file with a hardcoded secret
    await writeFile(
      join(tempDir, 'secrets.ts'),
      'export const DB_URL = "postgres://admin:supersecret@db.example.com:5432/prod";\n',
    );

    // Stage the file
    await git(['add', 'secrets.ts'], tempDir);

    // Replace the hook with a direct call to our built CLI so it works in
    // the temp directory (the `npx archguardian` from init won't resolve here).
    const hookPath = join(tempDir, '.git', 'hooks', 'pre-commit');
    const cliUnix = CLI.replace(/\\/g, '/');
    const hookScript =
      '#!/usr/bin/env sh\n' +
      'export NO_COLOR=1\n' +
      `node "${cliUnix}" check\n` +
      'RESULT=$?\n' +
      'if [ $RESULT -ne 0 ]; then\n' +
      '  echo ""\n' +
      '  echo "Commit blocked by Architecture Guardian."\n' +
      '  exit $RESULT\n' +
      'fi\n';
    await writeFile(hookPath, hookScript, { mode: 0o755 });

    // Attempt to commit — should be blocked by the hook
    const commitResult = await gitMayFail(
      ['commit', '-m', 'should be blocked'],
      tempDir,
    );

    expect(commitResult.exitCode).not.toBe(0);

    // Verify no new commit was created
    const logAfter = await git(['rev-list', '--count', 'HEAD'], tempDir);
    const commitCountAfter = parseInt(logAfter, 10);
    expect(commitCountAfter).toBe(commitCountBefore);
  }, 30_000);

  // ────────────────────────────────────────────────────────────────
  // 6. Clean code passes all checks
  // ────────────────────────────────────────────────────────────────
  it('clean code passes with exit code 0', async () => {
    await writeFile(join(tempDir, '.archguard.yml'), DEFAULT_CONFIG);

    await writeFile(
      join(tempDir, 'clean.ts'),
      [
        'export function greetUser(name: string): string {',
        '  return `Hello, ${name}!`;',
        '}',
        '',
        'export function calculateSum(a: number, b: number): number {',
        '  return a + b;',
        '}',
        '',
      ].join('\n'),
    );

    await git(['add', 'clean.ts'], tempDir);

    const { stdout, stderr, exitCode } = await run(['check'], tempDir);

    expect(exitCode).toBe(0);
  }, 30_000);

  // ────────────────────────────────────────────────────────────────
  // 7. Fix command removes unused imports
  // ────────────────────────────────────────────────────────────────
  it('fix --dry-run previews, fix applies removal of unused imports', async () => {
    await writeFile(join(tempDir, '.archguard.yml'), DEFAULT_CONFIG);

    const filePath = join(tempDir, 'fixable.ts');
    await writeFile(
      filePath,
      [
        "import { readFile } from 'node:fs/promises';",
        "import { join } from 'node:path';",
        '',
        'const p = join("a", "b");',
        'console.log(p);',
        '',
      ].join('\n'),
    );

    // Must be committed so `fix` can see it as a tracked file
    await git(['add', 'fixable.ts'], tempDir);
    await git(['commit', '-m', 'add fixable file'], tempDir);

    // Dry run — should show the fix preview
    const dryResult = await run(['fix', '--dry-run'], tempDir);
    expect(dryResult.exitCode).toBe(0);
    // The dry-run output should mention unused import of readFile
    expect(dryResult.stdout).toContain('readFile');

    // Apply fix
    const fixResult = await run(['fix'], tempDir);
    expect(fixResult.exitCode).toBe(0);

    // Read the file back — the unused import should be removed
    const updatedContent = await readFile(filePath, 'utf-8');

    // readFile is unused, so it should be removed
    // join is used, so it must remain
    expect(updatedContent).toContain('join');
    expect(updatedContent).not.toContain('readFile');
  }, 30_000);

  // ────────────────────────────────────────────────────────────────
  // 8. Scan with SARIF output produces valid structure
  // ────────────────────────────────────────────────────────────────
  it('scan --format sarif outputs valid SARIF', async () => {
    await writeFile(join(tempDir, '.archguard.yml'), DEFAULT_CONFIG);

    // Include a file with a violation so the SARIF has at least one result
    await writeFile(
      join(tempDir, 'vuln.ts'),
      'const password = "secret_password_12345";\nexport default password;\n',
    );

    await git(['add', 'vuln.ts'], tempDir);
    await git(['commit', '-m', 'add vuln file'], tempDir);

    const { stdout } = await run(['scan', '--format', 'sarif'], tempDir);

    // Find the JSON block in stdout (there may be non-JSON preamble lines)
    const jsonStart = stdout.indexOf('{');
    expect(jsonStart).toBeGreaterThanOrEqual(0);

    const sarif = JSON.parse(stdout.slice(jsonStart));

    // Validate SARIF structure
    expect(sarif).toHaveProperty('$schema');
    expect(sarif.$schema).toContain('sarif');
    expect(sarif).toHaveProperty('version', '2.1.0');
    expect(sarif).toHaveProperty('runs');
    expect(Array.isArray(sarif.runs)).toBe(true);
    expect(sarif.runs.length).toBeGreaterThanOrEqual(1);

    const firstRun = sarif.runs[0];
    expect(firstRun).toHaveProperty('tool');
    expect(firstRun.tool).toHaveProperty('driver');
    expect(firstRun.tool.driver).toHaveProperty('name', 'archguardian');
    expect(firstRun).toHaveProperty('results');
    expect(Array.isArray(firstRun.results)).toBe(true);
    // There should be at least one finding (the hardcoded secret)
    expect(firstRun.results.length).toBeGreaterThan(0);

    // Each result should have the required SARIF fields
    const result = firstRun.results[0];
    expect(result).toHaveProperty('ruleId');
    expect(result).toHaveProperty('level');
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('locations');
  }, 30_000);

  // ────────────────────────────────────────────────────────────────
  // 9. Learn command infers conventions from codebase
  // ────────────────────────────────────────────────────────────────
  it('learn command infers conventions from consistent camelCase functions', async () => {
    await writeFile(join(tempDir, '.archguard.yml'), DEFAULT_CONFIG);

    // Create several files with consistent camelCase function naming
    const files = [
      {
        name: 'utils.ts',
        content: [
          'export function getUserName() { return "alice"; }',
          'export function calculateTotal(a: number, b: number) { return a + b; }',
          'export function formatDate(d: Date) { return d.toISOString(); }',
          '',
        ].join('\n'),
      },
      {
        name: 'helpers.ts',
        content: [
          'export function parseInput(raw: string) { return raw.trim(); }',
          'export function validateEmail(email: string) { return email.includes("@"); }',
          'export function buildQuery(params: Record<string, string>) { return ""; }',
          '',
        ].join('\n'),
      },
      {
        name: 'services.ts',
        content: [
          'export function fetchData() { return Promise.resolve([]); }',
          'export function processItems(items: string[]) { return items; }',
          'export function sendNotification(msg: string) { console.log(msg); }',
          '',
        ].join('\n'),
      },
    ];

    for (const f of files) {
      await writeFile(join(tempDir, f.name), f.content);
    }

    await git(['add', '.'], tempDir);
    await git(['commit', '-m', 'add source files'], tempDir);

    const { stdout, exitCode } = await run(['learn'], tempDir);

    expect(exitCode).toBe(0);
    // Should output convention inference results
    expect(stdout).toContain('functions');
    expect(stdout).toContain('camelCase');
    // Should mention it found files to analyze
    expect(stdout).toMatch(/Found \d+ TypeScript/);
  }, 30_000);

  // ────────────────────────────────────────────────────────────────
  // 10. Check catches violations only on staged changes (not on
  //     already-committed existing code)
  // ────────────────────────────────────────────────────────────────
  it('check reports violations only on staged changes, not existing code', async () => {
    await writeFile(join(tempDir, '.archguard.yml'), DEFAULT_CONFIG);

    // First: commit a clean file — no violations
    await writeFile(
      join(tempDir, 'existing.ts'),
      'export function existingHelper() { return true; }\n',
    );
    await git(['add', '.'], tempDir);
    await git(['commit', '-m', 'add existing clean file'], tempDir);

    // Now: create a NEW file with a hardcoded secret and stage it
    await writeFile(
      join(tempDir, 'new-file.ts'),
      'export const TOKEN = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij1234";\n',
    );
    await git(['add', 'new-file.ts'], tempDir);

    const { stdout, exitCode } = await run(['check'], tempDir);

    // The new file's secret should be caught
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain('new-file.ts');
    expect(stdout).toContain('hardcoded');

    // The existing clean file should NOT appear in the findings
    // (it was not staged, so check should not analyze it)
    const lines = stdout.split('\n');
    const findingLines = lines.filter(
      (l) => l.includes('existing.ts') && (l.includes('error') || l.includes('warning')),
    );
    expect(findingLines.length).toBe(0);
  }, 30_000);
});
