import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IacAnalyzer } from '../../src/analyzers/iac-analyzer.js';
import { Severity, type AnalysisContext, type ArchGuardConfig } from '../../src/core/types.js';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeConfig(): ArchGuardConfig {
  return {
    ...DEFAULT_CONFIG,
    analyzers: {
      ...DEFAULT_CONFIG.analyzers,
      iac: { enabled: true, severity: Severity.Warning, dockerfile: true, kubernetes: true, actions: true },
    },
  };
}

function makeContext(projectRoot: string): AnalysisContext {
  return {
    files: [], parsedFiles: [],
    config: makeConfig(), projectRoot,
  };
}

describe('IacAnalyzer', () => {
  const analyzer = new IacAnalyzer();
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `iac-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('detects Dockerfile running as root', async () => {
    await writeFile(join(testDir, 'Dockerfile'), 'FROM node:18\nRUN npm install\nCMD ["node", "app.js"]');
    const ctx = makeContext(testDir);
    const findings = await analyzer.analyze(ctx);
    expect(findings.some(f => f.ruleId === 'iac/docker-run-as-root')).toBe(true);
  });

  it('detects :latest tag in FROM', async () => {
    await writeFile(join(testDir, 'Dockerfile'), 'FROM node:latest\nUSER node\nHEALTHCHECK CMD curl -f http://localhost/');
    const ctx = makeContext(testDir);
    const findings = await analyzer.analyze(ctx);
    expect(findings.some(f => f.ruleId === 'iac/docker-latest-tag')).toBe(true);
  });

  it('detects curl pipe bash', async () => {
    await writeFile(join(testDir, 'Dockerfile'), 'FROM node:18\nRUN curl https://example.com | bash\nUSER node\nHEALTHCHECK CMD true');
    const ctx = makeContext(testDir);
    const findings = await analyzer.analyze(ctx);
    expect(findings.some(f => f.ruleId === 'iac/docker-curl-pipe-bash')).toBe(true);
  });

  it('detects exposed secrets in ENV', async () => {
    await writeFile(join(testDir, 'Dockerfile'), 'FROM node:18\nENV PASSWORD=secret123\nUSER node\nHEALTHCHECK CMD true');
    const ctx = makeContext(testDir);
    const findings = await analyzer.analyze(ctx);
    expect(findings.some(f => f.ruleId === 'iac/docker-exposed-secrets')).toBe(true);
  });

  it('detects ADD instead of COPY', async () => {
    await writeFile(join(testDir, 'Dockerfile'), 'FROM node:18\nADD ./app /app\nUSER node\nHEALTHCHECK CMD true');
    const ctx = makeContext(testDir);
    const findings = await analyzer.analyze(ctx);
    expect(findings.some(f => f.ruleId === 'iac/docker-add-vs-copy')).toBe(true);
  });

  it('detects missing HEALTHCHECK', async () => {
    await writeFile(join(testDir, 'Dockerfile'), 'FROM node:18\nUSER node');
    const ctx = makeContext(testDir);
    const findings = await analyzer.analyze(ctx);
    expect(findings.some(f => f.ruleId === 'iac/docker-no-healthcheck')).toBe(true);
  });

  it('detects k8s privileged containers', async () => {
    const k8sDir = join(testDir, 'k8s');
    await mkdir(k8sDir, { recursive: true });
    await writeFile(join(k8sDir, 'deploy.yaml'), `apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: app
          securityContext:
            privileged: true
          resources:
            limits:
              memory: "128Mi"`);
    const ctx = makeContext(testDir);
    const findings = await analyzer.analyze(ctx);
    expect(findings.some(f => f.ruleId === 'iac/k8s-privileged')).toBe(true);
  });

  it('detects GitHub Actions mutable action ref', async () => {
    const ghDir = join(testDir, '.github', 'workflows');
    await mkdir(ghDir, { recursive: true });
    await writeFile(join(ghDir, 'ci.yml'), `name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: some-org/some-action@main`);
    const ctx = makeContext(testDir);
    const findings = await analyzer.analyze(ctx);
    expect(findings.some(f => f.ruleId === 'iac/gha-mutable-action-ref')).toBe(true);
  });
});
