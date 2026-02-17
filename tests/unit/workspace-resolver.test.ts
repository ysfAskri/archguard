import { describe, it, expect } from 'vitest';
import { resolveWorkspaceConfig } from '../../src/core/workspace-resolver.js';
import { Severity, type ArchGuardConfig } from '../../src/core/types.js';
import { DEFAULT_CONFIG } from '../../src/core/config-loader.js';

function makeConfig(workspaces?: Record<string, Partial<ArchGuardConfig>>): ArchGuardConfig {
  return { ...DEFAULT_CONFIG, workspaces };
}

describe('resolveWorkspaceConfig', () => {
  it('returns original config when no workspaces defined', () => {
    const config = makeConfig();
    const result = resolveWorkspaceConfig('src/app.ts', config);
    expect(result).toEqual(config);
  });

  it('returns original config when file matches no pattern', () => {
    const config = makeConfig({
      'packages/api/**': { analyzers: { security: { enabled: true, severity: Severity.Error } } as any },
    });
    const result = resolveWorkspaceConfig('src/other.ts', config);
    expect(result.analyzers.security.severity).toBe(config.analyzers.security.severity);
  });

  it('merges analyzer overrides for matching workspace', () => {
    const config = makeConfig({
      'packages/api/**': {
        analyzers: { security: { severity: Severity.Info } } as any,
      },
    });
    const result = resolveWorkspaceConfig('packages/api/src/handler.ts', config);
    expect(result.analyzers.security.severity).toBe(Severity.Info);
  });

  it('merges severity overrides', () => {
    const config = makeConfig({
      'packages/ui/**': {
        severity: { maxWarnings: 50 },
      } as Partial<ArchGuardConfig>,
    });
    const result = resolveWorkspaceConfig('packages/ui/Button.tsx', config);
    expect(result.severity.maxWarnings).toBe(50);
    // Original failOn should be preserved
    expect(result.severity.failOn).toBe(config.severity.failOn);
  });

  it('first matching pattern wins', () => {
    const config = makeConfig({
      'packages/api/**': {
        analyzers: { security: { severity: Severity.Error } } as any,
      },
      'packages/**': {
        analyzers: { security: { severity: Severity.Info } } as any,
      },
    });
    const result = resolveWorkspaceConfig('packages/api/src/handler.ts', config);
    expect(result.analyzers.security.severity).toBe(Severity.Error);
  });
});
