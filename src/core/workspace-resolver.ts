import { minimatch } from 'minimatch';
import type { ArchGuardConfig } from './types.js';

/**
 * Resolves workspace-specific config overrides for a given file path.
 * Workspace overrides take precedence over root config for analyzers and severity.
 */
export function resolveWorkspaceConfig(
  filePath: string,
  config: ArchGuardConfig,
): ArchGuardConfig {
  if (!config.workspaces) return config;

  // Find matching workspace patterns (first match wins)
  for (const [pattern, overrides] of Object.entries(config.workspaces)) {
    if (minimatch(filePath, pattern)) {
      return mergeWorkspaceOverrides(config, overrides);
    }
  }

  return config;
}

function mergeWorkspaceOverrides(
  base: ArchGuardConfig,
  overrides: Partial<ArchGuardConfig>,
): ArchGuardConfig {
  const merged = { ...base };

  // Merge severity overrides
  if (overrides.severity) {
    merged.severity = {
      ...base.severity,
      ...overrides.severity,
    };
  }

  // Merge analyzer overrides (deep merge per analyzer key)
  if (overrides.analyzers) {
    const analyzers = { ...base.analyzers } as Record<string, any>;
    for (const [key, value] of Object.entries(overrides.analyzers)) {
      if (value && typeof value === 'object') {
        analyzers[key] = { ...(analyzers[key] ?? {}), ...value };
      }
    }
    merged.analyzers = analyzers as typeof base.analyzers;
  }

  return merged;
}
