import type { Analyzer, ArchGuardConfig } from '../core/types.js';
import { SecurityScanner } from '../analyzers/security-scanner.js';
import { AiSmellDetector } from '../analyzers/ai-smell-detector.js';
import { ConventionEnforcer } from '../analyzers/convention-enforcer.js';
import { DuplicateDetector } from '../analyzers/duplicate-detector.js';
import { LayerViolationDetector } from '../analyzers/layer-violation.js';
import { loadPlugins } from '../plugins/loader.js';

export async function createAnalyzers(config: ArchGuardConfig): Promise<Analyzer[]> {
  const analyzers: Analyzer[] = [];

  if (config.analyzers.security.enabled) {
    analyzers.push(new SecurityScanner());
  }
  if (config.analyzers.aiSmells.enabled) {
    analyzers.push(new AiSmellDetector());
  }
  if (config.analyzers.conventions.enabled) {
    analyzers.push(new ConventionEnforcer());
  }
  if (config.analyzers.duplicates.enabled) {
    analyzers.push(new DuplicateDetector());
  }
  if (config.analyzers.architecture.enabled) {
    analyzers.push(new LayerViolationDetector());
  }

  // Load external plugin analyzers
  const pluginAnalyzers = await loadPlugins(config);
  analyzers.push(...pluginAnalyzers);

  return analyzers;
}
