// Public API for programmatic usage
export { loadConfig, generateDefaultConfig } from './core/config-loader.js';
export { parseDiff, detectLanguage } from './core/diff-parser.js';
export { buildContext } from './core/context.js';
export { runPipeline } from './core/pipeline.js';
export { getExitCode, severityAtLeast } from './core/severity.js';
export { Severity, ExitCode } from './core/types.js';
export { parseSuppressionDirectives, applySuppression } from './core/suppression.js';
export { saveBaseline, loadBaseline, filterByBaseline, handleBaseline } from './core/baseline.js';

export { SecurityScanner } from './analyzers/security-scanner.js';
export { AiSmellDetector } from './analyzers/ai-smell-detector.js';
export { ConventionEnforcer } from './analyzers/convention-enforcer.js';
export { DuplicateDetector } from './analyzers/duplicate-detector.js';
export { LayerViolationDetector } from './analyzers/layer-violation.js';
export { loadPlugins } from './plugins/loader.js';

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
} from './core/types.js';
export type { SuppressionDirective } from './core/suppression.js';
export type { BaselineFile, BaselineEntry } from './core/baseline.js';
