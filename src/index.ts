// Public API for programmatic usage
export { loadConfig, generateDefaultConfig } from './core/config-loader.js';
export { parseDiff, detectLanguage } from './core/diff-parser.js';
export { buildContext } from './core/context.js';
export { runPipeline } from './core/pipeline.js';
export { getExitCode, severityAtLeast } from './core/severity.js';
export { Severity, ExitCode } from './core/types.js';
export { parseSuppressionDirectives, applySuppression } from './core/suppression.js';
export { saveBaseline, loadBaseline, filterByBaseline, handleBaseline, contentFingerprint } from './core/baseline.js';
export { evaluateQualityGate } from './core/quality-gate.js';

// Analyzers
export { SecurityScanner } from './analyzers/security-scanner.js';
export { AiSmellDetector } from './analyzers/ai-smell-detector.js';
export { ConventionEnforcer } from './analyzers/convention-enforcer.js';
export { DuplicateDetector } from './analyzers/duplicate-detector.js';
export { LayerViolationDetector } from './analyzers/layer-violation.js';
export { ImpactAnalyzer } from './analyzers/impact-analyzer.js';
export { TaintAnalyzer } from './analyzers/taint-analyzer.js';
export { DependencyScanner } from './analyzers/dependency-scanner.js';
export { ComplexityAnalyzer } from './analyzers/complexity-analyzer.js';
export { IacAnalyzer } from './analyzers/iac-analyzer.js';
export { DeadCodeAnalyzer } from './analyzers/dead-code-analyzer.js';
export { CoverageAnalyzer } from './analyzers/coverage-analyzer.js';
export { LicenseScanner } from './analyzers/license-scanner.js';
export { StructuralRuleAnalyzer } from './analyzers/structural-rule-analyzer.js';
export { loadPlugins } from './plugins/loader.js';

// Dependency collector
export { collectDependencies } from './core/dependency-collector.js';

// Workspace resolver
export { resolveWorkspaceConfig } from './core/workspace-resolver.js';

// GitHub PR integration
export { postPrReview, postPrSummary, parsePrContext } from './ci/github-pr-commenter.js';

// Memory
export { loadMemory, saveMemory, addMemoryEntry, applyMemory } from './core/memory.js';

// Dependency graph
export { buildDependencyGraph, getConsumers, getImpactedFiles } from './core/dependency-graph.js';

// CI
export { formatGitHubAnnotation, formatAnnotations } from './ci/github-annotator.js';

// Mermaid diagrams
export { generateImpactDiagram, generateArchitectureDiagram } from './core/mermaid.js';

// Natural language rules
export { parseRulesFile, NaturalLanguageAnalyzer } from './rules/natural-language.js';

// Fixes
export { applyFixes, getAvailableFixes } from './fixes/index.js';

export type {
  Finding,
  FileInfo,
  AnalysisContext,
  AnalysisSummary,
  AnalyzerResult,
  Analyzer,
  ArchGuardConfig,
  ParsedFile,
  SupportedLanguage,
  QualityGateConfig,
  MemoryConfig,
  ImpactConfig,
  TaintConfig,
  DependencyConfig,
  ComplexityConfig,
  IacConfig,
  DeadCodeConfig,
  CoverageConfig,
  LicenseConfig,
} from './core/types.js';
export type { PackageDependency } from './core/dependency-collector.js';
export type { SuppressionDirective } from './core/suppression.js';
export type { BaselineFile, BaselineEntry } from './core/baseline.js';
export type { QualityGateResult, QualityGateFailure } from './core/quality-gate.js';
export type { MemoryEntry } from './core/memory.js';
export type { DependencyGraph } from './core/dependency-graph.js';
