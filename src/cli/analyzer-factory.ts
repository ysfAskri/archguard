import type { Analyzer, ArchGuardConfig } from '../core/types.js';
import { SecurityScanner } from '../analyzers/security-scanner.js';
import { AiSmellDetector } from '../analyzers/ai-smell-detector.js';
import { ConventionEnforcer } from '../analyzers/convention-enforcer.js';
import { DuplicateDetector } from '../analyzers/duplicate-detector.js';
import { LayerViolationDetector } from '../analyzers/layer-violation.js';
import { ImpactAnalyzer } from '../analyzers/impact-analyzer.js';
import { TaintAnalyzer } from '../analyzers/taint-analyzer.js';
import { DependencyScanner } from '../analyzers/dependency-scanner.js';
import { ComplexityAnalyzer } from '../analyzers/complexity-analyzer.js';
import { IacAnalyzer } from '../analyzers/iac-analyzer.js';
import { DeadCodeAnalyzer } from '../analyzers/dead-code-analyzer.js';
import { CoverageAnalyzer } from '../analyzers/coverage-analyzer.js';
import { LicenseScanner } from '../analyzers/license-scanner.js';
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
  if (config.analyzers.impact?.enabled) {
    analyzers.push(new ImpactAnalyzer());
  }
  if (config.analyzers.taint?.enabled) {
    analyzers.push(new TaintAnalyzer());
  }
  if (config.analyzers.dependencies?.enabled) {
    analyzers.push(new DependencyScanner());
  }
  if (config.analyzers.complexity?.enabled) {
    analyzers.push(new ComplexityAnalyzer());
  }
  if (config.analyzers.iac?.enabled) {
    analyzers.push(new IacAnalyzer());
  }
  if (config.analyzers.deadCode?.enabled) {
    analyzers.push(new DeadCodeAnalyzer());
  }
  if (config.analyzers.coverage?.enabled) {
    analyzers.push(new CoverageAnalyzer());
  }
  if (config.analyzers.licenses?.enabled) {
    analyzers.push(new LicenseScanner());
  }

  // Structural YAML rules analyzer
  if (config.rules?.astgrep) {
    const { StructuralRuleAnalyzer } = await import('../analyzers/structural-rule-analyzer.js');
    analyzers.push(new StructuralRuleAnalyzer());
  }

  // Natural language rules analyzer
  if (config.rules && config.llm.enabled) {
    const { NaturalLanguageAnalyzer } = await import('../rules/natural-language.js');
    analyzers.push(new NaturalLanguageAnalyzer());
  }

  // Load external plugin analyzers
  const pluginAnalyzers = await loadPlugins(config);
  analyzers.push(...pluginAnalyzers);

  return analyzers;
}
