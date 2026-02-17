import { describe, it, expect } from 'vitest';
import { DependencyScanner } from '../../src/analyzers/dependency-scanner.js';
import { Severity, type AnalysisContext, type ArchGuardConfig } from '../../src/core/types.js';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';

describe('DependencyScanner', () => {
  const scanner = new DependencyScanner();

  it('reports nothing when disabled', async () => {
    const config: ArchGuardConfig = { ...DEFAULT_CONFIG };
    const context: AnalysisContext = { files: [], parsedFiles: [], config, projectRoot: '/project' };
    const findings = await scanner.analyze(context);
    expect(findings).toHaveLength(0);
  });

  it('has correct name', () => {
    expect(scanner.name).toBe('dependencies');
  });
});
